import { createHash } from "node:crypto";
import type { AlertCriteria, AlertSearchInput } from "@workspace/api-zod";
import type { listingsTable } from "@workspace/db";

export type SearchListing = typeof listingsTable.$inferSelect;
const digits = "٠١٢٣٤٥٦٧٨٩";
export function normalize(value: string): string {
  return value.toLowerCase().replace(/[٠-٩]/g, (c) => String(digits.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[أإآٱ]/g, "ا").replace(/[ى]/g, "ي").replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/٫/g, ".").replace(/\s+/g, " ").trim();
}

const groups = [
  ["tiles", "بلاط", "سيراميك", "tile", "tiles", "ceramic", "ceramics"],
  ["porcelain", "بورسلان", "بورسلين", "porcelain"],
  ["cement", "اسمنت", "cement"],
  ["timber", "خشب", "اخشاب", "timber", "wood"],
  ["rebar", "حديد", "حديد تسليح", "rebar", "steel"],
  ["paint", "دهان", "دهانات", "paint"],
  ["beige", "بيج", "beige"],
  ["white", "ابيض", "بيضاء", "white"],
  ["gray", "رمادي", "رماديه", "grey", "gray"],
  ["black", "اسود", "سوداء", "black"],
  ["brown", "بني", "brown"],
  ["matte", "مطفي", "مطفيه", "matte", "matt"],
  ["polished", "لامع", "مصقول", "polished", "glossy"],
];
const materialKeys = new Set(["tiles", "porcelain", "cement", "timber", "rebar", "paint"]);
const colorKeys = new Set(["beige", "white", "gray", "black", "brown"]);
const categories: Record<string, string> = { tiles: "tiles", porcelain: "tiles", cement: "building-materials", timber: "timber", rebar: "rebar", paint: "paint" };
function hasTerm(text: string, word: string): boolean {
  const escaped = normalize(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:ال)?${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalize(text));
}
function groupOf(value: string) { return groups.find((g) => g.some((term) => normalize(term) === normalize(value))); }
function confirms(text: string, value: string): boolean {
  const group = groupOf(value);
  if (group?.[0] === "tiles" && hasTerm(text, "porcelain")) return true;
  if (group?.[0] === "tiles" && (hasTerm(text, "بورسلان") || hasTerm(text, "بورسلين"))) return true;
  return group ? group.slice(1).some((term) => hasTerm(text, term)) : hasTerm(text, value);
}

const neighborhoods: Record<string, string[]> = {
  yasmin: ["الياسمين", "ياسمين", "al yasmin", "al-yasmin", "yasmin"],
  malqa: ["الملقا", "ملقا", "al malqa", "al-malqa", "malqa"],
  narjis: ["النرجس", "نرجس", "al narjis", "al-narjis", "narjis"],
};
function neighborhoodKey(value: string): string {
  const n = normalize(value).replace(/^(?:حي|neighborhood)\s+/, "");
  return Object.entries(neighborhoods).find(([, names]) => names.includes(n))?.[0] ?? n;
}

type Unit = { dimension: string; factor: number; label: string };
export function unitInfo(value: string): Unit {
  const n = normalize(value).replace(/\s+/g, "");
  if (["m²", "m2", "م²", "م2", "مترمربع", "مترمربّع", "sqm"].includes(n)) return { dimension: "area", factor: 1, label: "m²" };
  if (["cm²", "cm2", "سم²", "سم2"].includes(n)) return { dimension: "area", factor: .0001, label: "cm²" };
  if (["m³", "m3", "م³", "م3", "مترمكعب"].includes(n)) return { dimension: "volume", factor: 1, label: "m³" };
  if (["kg", "كجم", "كغ", "كيلو", "كيلوغرام", "كيلوجرام"].includes(n)) return { dimension: "mass", factor: 1, label: "kg" };
  if (["ton", "طن", "طنّ", "t", "tonne"].includes(n)) return { dimension: "mass", factor: 1000, label: "ton" };
  if (["g", "جم", "غرام"].includes(n)) return { dimension: "mass", factor: .001, label: "g" };
  if (["m", "م", "متر"].includes(n)) return { dimension: "length", factor: 1, label: "m" };
  if (["cm", "سم"].includes(n)) return { dimension: "length", factor: .01, label: "cm" };
  if (["mm", "مم"].includes(n)) return { dimension: "length", factor: .001, label: "mm" };
  const aliases: Record<string, string[]> = { piece: ["piece", "pieces", "قطعة", "قطعه", "قطع"], box: ["box", "boxes", "كرتون", "صندوق"], bag: ["bag", "bags", "كيس", "اكياس"], sheet: ["sheet", "لوح", "الواح"], roll: ["roll", "لفة", "لفه"], pallet: ["pallet", "منصة", "منصه"] };
  const key = Object.entries(aliases).find(([, list]) => list.includes(n))?.[0] ?? n;
  return { dimension: key, factor: 1, label: key };
}

const dimPattern = /(\d+(?:\.\d+)?)\s*(cm|mm|سم|مم|m|م)?\s*[×x✕*]\s*(\d+(?:\.\d+)?)\s*(cm|mm|سم|مم|m|م)?(?![²³\w])/giu;
export function dimensionKeys(value: string): string[] {
  return [...normalize(value).matchAll(dimPattern)].map((m) => {
    const u = m[4] || m[2] || "cm";
    const scale = (v?: string) => ["mm", "مم"].includes(v || u) ? .1 : ["m", "م"].includes(v || u) ? 100 : 1;
    return [Number((Number(m[1]) * scale(m[2])).toPrecision(9)), Number((Number(m[3]) * scale(m[4])).toPrecision(9))].sort((a, b) => a - b).join("×");
  });
}

/** Deterministic extraction only. Never fill in unprovided size, price, neighborhood or quantity. */
export function criteriaFromSearch(input: AlertSearchInput): AlertCriteria {
  const result: AlertCriteria = {};
  let text = normalize(input.q ?? "");
  if (input.q?.trim()) result.requestText = input.q.trim();
  for (const key of ["categoryId", "condition", "freeOnly", "objectPath"] as const) {
    if (input[key]) Object.assign(result, { [key]: input[key] });
  }
  const dims = [...text.matchAll(dimPattern)];
  if (dims.length) { result.dimensions = dims[0][0]; text = text.replace(dimPattern, " "); }
  const unitPrice = text.match(/(?:سعر الوحد[ةه]|per unit|max unit price)\s*(?:[:=]|حتى|under|of)?\s*(\d+(?:\.\d+)?)/i);
  if (unitPrice) { result.maxUnitPrice = Number(unitPrice[1]); text = text.replace(unitPrice[0], " "); }
  const budget = text.match(/(?:ب?ميزاني(?:ه|ة|تي)|budget|max(?:imum)?(?: total)?|ب?حد اقص[ىي]|under)\s*(?:[:=]|of|is|حتى|اجمالي|ريال|sar)?\s*(\d+(?:\.\d+)?)/i);
  if (budget) { result.budget = Number(budget[1]); text = text.replace(budget[0], " "); }
  const quantity = text.match(/(\d+(?:\.\d+)?)\s*(متر\s*مربع|متر\s*مكعب|m²|m2|م²|م2|sqm|m³|m3|م³|م3|cm²|cm2|kg|كجم|كغ|كيلو(?:غرام|جرام)?|ton(?:ne)?|طن|piece(?:s)?|قطع[ةه]?|box(?:es)?|كرتون|bag(?:s)?|كيس|sheet|لوح|roll|لف[ةه]|pallet|منص[ةه]|متر|cm|mm|سم|مم|m|م)(?=$|[^a-z\u0600-\u06ff])/i);
  if (quantity) {
    if (Number(quantity[1]) > 0) { result.quantity = Number(quantity[1]); result.unit = unitInfo(quantity[2]).label; }
    text = text.replace(quantity[0], " ");
  }
  if (input.minQuantity) { result.quantity = input.minQuantity; result.unit = input.unit ? unitInfo(input.unit).label : result.unit; }
  if (!result.quantity && input.unit?.trim()) result.unit = unitInfo(input.unit).label;
  const hood = text.match(/(?:حي|neighborhood)\s+([\p{L}\s-]+?)(?=\s+(?:بميزانية|بميزانيه|budget|مجاني|free)|$)/u);
  if (hood) { result.neighborhood = hood[1].trim(); text = text.replace(hood[0], " "); }
  if (/\bfree\b|مجاني/.test(text)) { result.freeOnly = true; text = text.replace(/\bfree\b|مجاني(?:ة|ه)?/g, " "); }
  for (const group of groups) {
    if (!group.slice(1).some((term) => hasTerm(text, term))) continue;
    const key = group[0];
    if (materialKeys.has(key)) {
      result.material = key;
      if (!result.categoryId) result.categoryId = categories[key];
    } else if (colorKeys.has(key)) result.color = key;
    else result.finish = key;
    for (const term of group.slice(1).sort((a, b) => b.length - a.length)) {
      const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`(^|[^\\p{L}\\p{N}])(?:ال)?${escaped}(?=$|[^\\p{L}\\p{N}])`, "gu"), "$1 ");
    }
  }
  const model = text.match(/(?:موديل|طراز|model)\s*[:#]?\s*([\p{L}\d-]+)/u);
  if (model) { result.model = model[1]; text = text.replace(model[0], " "); }
  const stop = new Set(["احتاج", "ابحث", "اريد", "ابي", "ابغي", "عن", "في", "الرياض", "رياض", "من", "ريال", "ريالات", "و", "الى", "لدي", "need", "i", "want", "looking", "for", "in", "riyadh", "sar", "and", "the", "of", "a"]);
  const residual = text.replace(/[،,؛:؟?!]/g, " ").split(/\s+/).filter((t) => t && !stop.has(t)).join(" ");
  if (residual) result.keywords = residual;
  return canonicalCriteria(result);
}

export function canonicalCriteria(input: AlertCriteria): AlertCriteria {
  const result: AlertCriteria = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim()) Object.assign(result, { [key]: value.trim() });
    else if (typeof value === "number" || value === true) Object.assign(result, { [key]: value });
  }
  if (result.unit) result.unit = unitInfo(result.unit).label;
  return result;
}

export function criteriaFingerprint(criteria: AlertCriteria): string {
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(criteria).sort()) {
    if (key === "requestText") continue;
    let value = criteria[key as keyof AlertCriteria];
    if (key === "quantity" && criteria.unit) value = Number((Number(value) * unitInfo(criteria.unit).factor).toPrecision(12));
    else if (key === "unit") value = unitInfo(String(value)).dimension;
    else if (key === "dimensions") value = dimensionKeys(String(value)).join("|") || normalize(String(value));
    else if (key === "neighborhood") value = neighborhoodKey(String(value));
    else if (key === "keywords") value = [...new Set(normalize(String(value)).split(/\s+/))].sort().join(" ");
    else if (typeof value === "string" && key !== "objectPath") value = groupOf(value)?.[0] ?? normalize(value);
    if (value !== false && value !== undefined && value !== "") normalized[key] = value;
  }
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export type EligiblePurchase = { requestedQuantity: number | null; purchaseQuantity: number; totalPrice: number };
/** Shared by ordinary search, photo search and saved alerts. No inventory mutation. */
export function eligiblePurchase(row: SearchListing, c: AlertCriteria, excludeBuyer?: string): EligiblePurchase | null {
  if (!row.isAvailable || row.quantity <= 0 || row.sellerId === excludeBuyer) return null;
  if (c.categoryId && c.categoryId !== row.categoryId) return null;
  if (c.condition && c.condition !== row.condition) return null;
  if (c.freeOnly && !row.isFree) return null;
  if (c.neighborhood && neighborhoodKey(c.neighborhood) !== neighborhoodKey(row.neighborhood)) return null;
  const facts = `${row.title} ${row.description}`;
  for (const key of ["material", "color", "finish", "model"] as const) {
    if (c[key] && !confirms(facts, c[key])) return null;
  }
  if (c.dimensions) {
    const wanted = dimensionKeys(c.dimensions);
    const stated = [...new Set(dimensionKeys(facts))];
    if (!wanted.length || !wanted.every((dim) => stated.includes(dim)) || stated.some((dim) => !wanted.includes(dim))) return null;
  }
  if (c.keywords && !normalize(c.keywords).split(/\s+/).every((term) => confirms(facts, term))) return null;
  let requested = c.quantity ?? null;
  if (c.unit) {
    const from = unitInfo(c.unit), to = unitInfo(row.unit);
    if (from.dimension !== to.dimension) return null;
    if (requested !== null) requested = Number((requested * from.factor / to.factor).toPrecision(12));
  } else if (requested !== null) return null;
  const purchase = row.saleMode === "full_lot" ? row.quantity
    : Number((Math.ceil(((requested ?? row.minimumIncrement) - 1e-9) / row.minimumIncrement) * row.minimumIncrement).toPrecision(12));
  if (purchase <= 0 || purchase > row.quantity + 1e-9 || (requested !== null && purchase < requested - 1e-9)) return null;
  if (!row.isFree && (row.unitPrice === null || row.unitPrice < 0)) return null;
  const total = row.isFree ? 0 : Math.round(purchase * row.unitPrice! * 100) / 100;
  if (c.budget !== undefined && total > c.budget + 1e-9) return null;
  if (c.maxUnitPrice !== undefined && !row.isFree) {
    // Compare per requested unit, not a misleading cheaper converted listing unit.
    const price = row.unitPrice! * (c.unit ? unitInfo(c.unit).factor / unitInfo(row.unit).factor : 1);
    if (price > c.maxUnitPrice + 1e-9) return null;
  }
  return { requestedQuantity: requested, purchaseQuantity: purchase, totalPrice: total };
}
