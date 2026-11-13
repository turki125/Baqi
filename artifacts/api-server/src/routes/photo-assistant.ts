import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gt, gte, ilike, inArray, or } from "drizzle-orm";
import {
  InterpretTextSearchBody, InterpretTextSearchResponse,
  SearchByImageBody, SearchByImageResponse, SuggestListingDetailsBody,
  SuggestListingDetailsParams, SuggestListingDetailsResponse,
} from "@workspace/api-zod";
import { db, listingsTable } from "@workspace/db";
import { requireUser, userIdFromRequest } from "../lib/auth";
import { listingPhotoDataUrl, PhotoAiError, referencePhotoDataUrl, withPhotoBudget } from "../lib/photo-ai";
import { criteriaFromSearch, eligiblePurchase } from "../lib/search-criteria";
import { analyzeImageSearch, checkSearchRateLimit, emptyImageAttributes, emptySearchCriteria, emptySearchUsage, interpretTextSearch, suggestListingFromPhoto } from "../lib/openai-search";

type Category = { id: string; nameEn: string; nameAr: string };
type Row = typeof listingsTable.$inferSelect;

function meetsQuantity(row: Row, requested?: number) {
  if (!requested) return true;
  const actual = row.saleMode === "full_lot" ? row.quantity
    : Number((Math.ceil((requested - 1e-9) / row.minimumIncrement) * row.minimumIncrement).toPrecision(12));
  return actual >= requested - 1e-9 && actual <= row.quantity + 1e-9;
}

function textTermsFilter(termsEn?: string[], termsAr?: string[]) {
  const group = (terms?: string[]) => terms?.length
    ? and(...terms.map((term) => {
      const dimensions = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(term);
      const pattern = dimensions ? `%${dimensions[1]}%${dimensions[2]}%` : `%${term}%`;
      return or(ilike(listingsTable.title, pattern), ilike(listingsTable.description, pattern))!;
    }))
    : undefined;
  const alternatives = [group(termsEn), group(termsAr)].filter(Boolean);
  return alternatives.length ? or(...alternatives) : undefined;
}

function matchesCriteria(row: Row, criteria: {
  termsEn: string[]; termsAr: string[]; categoryId: string | null; minQuantity: number | null;
  unit: string | null; condition: "new" | "like_new" | "used" | null; freeOnly: boolean | null;
}) {
  if (criteria.categoryId && row.categoryId !== criteria.categoryId) return false;
  if (criteria.condition && row.condition !== criteria.condition) return false;
  if (criteria.freeOnly !== null && row.isFree !== criteria.freeOnly) return false;
  if (criteria.minQuantity) {
    if (!criteria.unit || row.unit !== criteria.unit || !meetsQuantity(row, criteria.minQuantity)) return false;
  }
  if (criteria.termsEn.length || criteria.termsAr.length) {
    const text = `${row.title} ${row.description}`.normalize("NFKC").toLocaleLowerCase().replace(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/g, "$1 $2");
    const hasAll = (terms: string[]) => terms.length > 0 && terms.every((term) =>
      text.includes(term.toLocaleLowerCase().replace(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i, "$1 $2")));
    if (!hasAll(criteria.termsEn) && !hasAll(criteria.termsAr)) return false;
  }
  return true;
}

function fail(req: Request, res: Response, error: unknown) {
  // Do not log SDK errors: provider messages may contain request content.
  const status = error instanceof PhotoAiError ? error.status : 503;
  req.log.warn({ status }, "Photo assistance request did not finish");
  if (status === 429) res.setHeader("Retry-After", "60");
  res.status(status).json({ error: error instanceof PhotoAiError ? error.message : "Photo assistance is temporarily unavailable." });
}

export function createPhotoAssistantRouter(categories: readonly Category[], toListing: (row: Row) => unknown): IRouter {
  const router = Router();

  router.post("/text-search", async (req, res): Promise<void> => {
    const input = InterpretTextSearchBody.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: "Enter a search phrase up to 500 characters." }); return; }
    try {
      checkSearchRateLimit(`text:${userIdFromRequest(req) ?? req.ip}`);
      const result = await interpretTextSearch(input.data.query, categories);
      req.log.info({ inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cached: result.cached }, "Baqi text search interpreted");
      res.json(InterpretTextSearchResponse.parse(result));
    } catch (error) { fail(req, res, error); }
  });

  router.post("/listings/:id/photo-suggestion", requireUser, async (req, res): Promise<void> => {
    const params = SuggestListingDetailsParams.safeParse(req.params);
    const input = SuggestListingDetailsBody.safeParse(req.body);
    if (!params.success || !input.success) { res.status(400).json({ error: "Invalid photo suggestion request" }); return; }
    const userId = userIdFromRequest(req)!;
    if (params.data.id !== "draft") {
      const [listing] = await db.select().from(listingsTable).where(and(eq(listingsTable.id, params.data.id), eq(listingsTable.sellerId, userId))).limit(1);
      if (!listing) { res.status(404).json({ error: "Your listing was not found" }); return; }
    }
    try {
      const result = await withPhotoBudget(userId, async () => {
        const photo = await referencePhotoDataUrl(input.data.objectPath, userId);
        const suggestion = await suggestListingFromPhoto(photo, categories);
        req.log.info({
          inputTokens: suggestion.usage.inputTokens,
          outputTokens: suggestion.usage.outputTokens,
        }, "Baqi listing photo suggestion generated");
        if (!suggestion.isMaterial || suggestion.confidence < 0.35
          || (!suggestion.title.trim() && !suggestion.description.trim() && !suggestion.categoryId)) {
          throw new PhotoAiError(422, "The material is unclear. Try a closer photo or enter details manually.");
        }
        return SuggestListingDetailsResponse.parse({
          categoryId: suggestion.categoryId,
          title: suggestion.title.trim(),
          description: suggestion.description.trim(),
          confidence: suggestion.confidence,
        });
      });
      res.json(result);
    } catch (error) { fail(req, res, error); }
  });

  router.post("/image-search", requireUser, async (req, res): Promise<void> => {
    const input = SearchByImageBody.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: "Invalid image search request" }); return; }
    const data = input.data;
    if ((data.minQuantity && !data.unit?.trim()) || (data.categoryId && !categories.some((c) => c.id === data.categoryId))
      || (data.q?.length ?? 0) > 300 || (data.queryText?.length ?? 0) > 500 || (data.unit?.length ?? 0) > 40) {
      res.status(400).json({ error: "Choose a valid category and an explicit unit for the requested quantity." }); return;
    }
    const userId = userIdFromRequest(req)!;
    try {
      const result = await withPhotoBudget(userId, async () => {
        const criteria = criteriaFromSearch({
          q: data.q,
          categoryId: data.categoryId,
          condition: data.condition,
          freeOnly: data.freeOnly,
          objectPath: data.objectPath,
          minQuantity: data.minQuantity,
          unit: data.unit,
        });
        const reference = await referencePhotoDataUrl(data.objectPath, userId);
        const hasBuyerText = !!data.queryText?.trim();
        const filters = [eq(listingsTable.isAvailable, true), gt(listingsTable.quantity, 0)];
        if (data.categoryId) filters.push(eq(listingsTable.categoryId, data.categoryId));
        if (data.condition) filters.push(eq(listingsTable.condition, data.condition));
        if (data.freeOnly !== undefined) filters.push(eq(listingsTable.isFree, data.freeOnly));
        if (data.minQuantity) filters.push(gte(listingsTable.quantity, data.minQuantity));
        if (data.unit?.trim()) filters.push(eq(listingsTable.unit, data.unit.trim()));
        if (hasBuyerText) {
          // The query text and image are analyzed together in one model request below.
        } else if (data.searchTermsEn?.length || data.searchTermsAr?.length) {
          const terms = textTermsFilter(data.searchTermsEn, data.searchTermsAr);
          if (terms) filters.push(terms);
        } else if (data.q?.trim()) {
          const term = `%${data.q.trim()}%`;
          filters.push(or(ilike(listingsTable.title, term), ilike(listingsTable.description, term))!);
        }
        const rows = await db.select().from(listingsTable).where(and(...filters)).orderBy(desc(listingsTable.createdAt));
        // A fixed comparison cap bounds cost; photos are resized before transmission.
        const candidates = rows
          .filter((row) => row.photos.length && meetsQuantity(row, data.minQuantity) && eligiblePurchase(row, criteria, userId))
          .slice(0, 12);
        if (!candidates.length) {
          return {
            listings: [],
            criteria: emptySearchCriteria(),
            attributes: emptyImageAttributes(),
            usage: emptySearchUsage(),
          };
        }
        const candidateInputs: { id: string; title: string; description: string; categoryId: string; imageUrl: string }[] = [];
        const usable: Row[] = [];
        for (const row of candidates) {
          try {
            const imageUrl = await listingPhotoDataUrl(row.photos[0], userId);
            candidateInputs.push({
              id: row.id,
              title: row.title,
              description: row.description,
              categoryId: row.categoryId,
              imageUrl,
            });
            usable.push(row);
          } catch { req.log.warn({ listingId: row.id }, "A listing photo could not be compared"); }
        }
        if (!usable.length) throw new PhotoAiError(503, "Listing photos could not be compared. Try text search instead.");
        const analysis = await analyzeImageSearch(
          reference,
          data.queryText ?? "",
          candidateInputs,
          categories,
        );
        if (!analysis.isMaterial) throw new PhotoAiError(422, "The photo does not show a recognisable building material. Try another photo.");
        const seen = new Set<string>();
        const matched = analysis.matches.filter((match) => match.score >= 0.55).sort((a, b) => b.score - a.score).flatMap((match) => {
          const row = usable.find((candidate) => candidate.id === match.id);
          if (!row || seen.has(row.id)) return [];
          seen.add(row.id); return [row];
        });
        if (data.sort === "price_low") matched.sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0));
        if (data.sort === "price_high") matched.sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0));
        if (data.sort === "newest") matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        // Recheck availability after the model call; never return now-sold stock.
        const fresh = matched.length
          ? await db.select().from(listingsTable).where(and(
            eq(listingsTable.isAvailable, true),
            gt(listingsTable.quantity, 0),
            inArray(listingsTable.id, matched.map((row) => row.id)),
          ))
          : [];
        const stillEligible = new Map(fresh.map((row) => [row.id, row]));
        const listings = matched.flatMap((row) => {
          const latest = stillEligible.get(row.id);
          if (!latest || !eligiblePurchase(latest, criteria, userId)
            || !meetsQuantity(latest, data.minQuantity) || !matchesCriteria(latest, analysis.criteria)) return [];
          if (data.categoryId && latest.categoryId !== data.categoryId) return [];
          if (data.condition && latest.condition !== data.condition) return [];
          if (data.freeOnly !== undefined && latest.isFree !== data.freeOnly) return [];
          if (data.unit && latest.unit !== data.unit) return [];
          if (!hasBuyerText && (data.searchTermsEn?.length || data.searchTermsAr?.length)) {
            const terms = { ...analysis.criteria, termsEn: data.searchTermsEn ?? [], termsAr: data.searchTermsAr ?? [] };
            if (!matchesCriteria(latest, terms)) return [];
          }
          if (!hasBuyerText && data.q?.trim()) {
            const phrase = data.q.trim().toLocaleLowerCase();
            if (!`${latest.title} ${latest.description}`.toLocaleLowerCase().includes(phrase)) return [];
          }
          return [toListing(latest)];
        });
        return { listings, criteria: analysis.criteria, attributes: analysis.attributes, usage: analysis.usage };
      });
      req.log.info({ inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, resultCount: result.listings.length }, "Baqi image search completed");
      res.json(SearchByImageResponse.parse(result));
    } catch (error) { fail(req, res, error); }
  });
  return router;
}
