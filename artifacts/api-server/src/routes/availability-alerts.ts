import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  DeleteAvailabilityAlertParams, GetAvailabilityUnsubscribeQueryParams, GetAvailabilityUnsubscribeResponse,
  GetAlertEmailStatusResponse, ListAvailabilityAlertsResponse, PreviewAvailabilityAlertBody, PreviewAvailabilityAlertResponse,
  SaveAvailabilityAlertBody, SaveAvailabilityAlertResponse, UnsubscribeAvailabilityEmailBody,
  UnsubscribeAvailabilityEmailResponse, UpdateAvailabilityAlertBody, UpdateAvailabilityAlertParams,
  UpdateAvailabilityAlertResponse,
} from "@workspace/api-zod";
import { db, availabilityAlertsTable as alerts, availabilityMatchesTable as matches, type AvailabilityAlertRow } from "@workspace/db";
import { requireUser, userIdFromRequest } from "../lib/auth";
import { canonicalCriteria, criteriaFingerprint, criteriaFromSearch, dimensionKeys } from "../lib/search-criteria";
import { accountEmail, emailMode, maskEmail } from "../lib/availability-mail";
import { referencePhoto, PhotoAiError } from "../lib/photo-ai";
import { wakeAvailabilityWorker } from "../lib/availability-engine";

const router: IRouter = Router();
router.use(["/availability-alerts", "/availability-email"], (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
async function presentAlert(row: AvailabilityAlertRow, existing?: boolean) {
  const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(matches).where(eq(matches.alertId, row.id));
  return { id: row.id, criteria: row.criteria, status: row.status, emailEnabled: row.emailEnabled,
    createdAt: row.createdAt, matchCount: count.count, ...(existing === undefined ? {} : { existing }) };
}

router.post("/availability-alerts/preview", (req, res): void => {
  const input = PreviewAvailabilityAlertBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid search criteria" }); return; }
  res.json(PreviewAvailabilityAlertResponse.parse(criteriaFromSearch(input.data)));
});

router.get("/availability-alerts/email-status", requireUser, async (req, res): Promise<void> => {
  try {
    const email = await accountEmail(userIdFromRequest(req)!);
    res.json(GetAlertEmailStatusResponse.parse({ maskedEmail: maskEmail(email.address), verified: email.verified, deliveryMode: emailMode() }));
  } catch {
    res.status(503).json({ error: "Account email verification status could not be checked. Your in-app alerts can still be saved." });
  }
});

router.get("/availability-alerts", requireUser, async (req, res): Promise<void> => {
  const rows = await db.select().from(alerts).where(and(eq(alerts.buyerId, userIdFromRequest(req)!), sql`${alerts.status} <> 'deleted'`)).orderBy(desc(alerts.createdAt));
  res.json(ListAvailabilityAlertsResponse.parse(await Promise.all(rows.map((r) => presentAlert(r)))));
});

router.post("/availability-alerts", requireUser, async (req, res): Promise<void> => {
  const input = SaveAvailabilityAlertBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid availability alert" }); return; }
  const criteria = canonicalCriteria(input.data.criteria);
  if ((criteria.quantity && !criteria.unit) || (criteria.dimensions && !dimensionKeys(criteria.dimensions).length)
    || !Object.keys(criteria).some((key) => key !== "requestText")) {
    res.status(400).json({ error: "Supply search criteria, a unit for quantity, and dimensions such as 60×60 cm." }); return;
  }
  const buyerId = userIdFromRequest(req)!;
  let dedupeCriteria = criteria;
  if (criteria.objectPath) {
    try {
      const reference = await referencePhoto(criteria.objectPath, buyerId);
      const content = reference.inlineData?.data;
      if (!content) throw new Error("No reference image data");
      dedupeCriteria = { ...criteria, objectPath: `sha256:${createHash("sha256").update(content).digest("hex")}` };
    }
    catch (err) { res.status(err instanceof PhotoAiError ? err.status : 503).json({ error: "Your private reference photo could not be verified." }); return; }
  }
  const id = randomUUID();
  const [row] = await db.insert(alerts).values({
    id, buyerId, fingerprint: criteriaFingerprint(dedupeCriteria), criteria: { ...criteria },
    unsubscribeToken: randomBytes(32).toString("hex"), emailEnabled: input.data.emailEnabled,
  }).onConflictDoUpdate({
    target: [alerts.buyerId, alerts.fingerprint],
    set: { status: "active", emailEnabled: sql`${alerts.emailEnabled} OR ${input.data.emailEnabled}` },
  }).returning();
  wakeAvailabilityWorker();
  res.json(SaveAvailabilityAlertResponse.parse(await presentAlert(row, row.id !== id)));
});

router.patch("/availability-alerts/:id", requireUser, async (req, res): Promise<void> => {
  const params = UpdateAvailabilityAlertParams.safeParse(req.params);
  const input = UpdateAvailabilityAlertBody.safeParse(req.body);
  if (!params.success || !input.success || !Object.keys(input.data).length) { res.status(400).json({ error: "Invalid availability-alert update" }); return; }
  const [row] = await db.update(alerts).set(input.data).where(and(
    eq(alerts.id, params.data.id), eq(alerts.buyerId, userIdFromRequest(req)!), sql`${alerts.status} <> 'deleted'`,
  )).returning();
  if (!row) { res.status(404).json({ error: "Saved search not found" }); return; }
  if (row.status === "active") wakeAvailabilityWorker();
  res.json(UpdateAvailabilityAlertResponse.parse(await presentAlert(row)));
});

router.delete("/availability-alerts/:id", requireUser, async (req, res): Promise<void> => {
  const params = DeleteAvailabilityAlertParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid alert" }); return; }
  const [row] = await db.update(alerts).set({ status: "deleted", emailEnabled: false, fingerprint: `deleted:${params.data.id}` }).where(and(
    eq(alerts.id, params.data.id), eq(alerts.buyerId, userIdFromRequest(req)!), sql`${alerts.status} <> 'deleted'`,
  )).returning();
  if (!row) { res.status(404).json({ error: "Saved search not found" }); return; }
  res.sendStatus(204);
});

router.get("/availability-email/unsubscribe", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const input = GetAvailabilityUnsubscribeQueryParams.safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid unsubscribe link" }); return; }
  const [row] = await db.select({ emailEnabled: alerts.emailEnabled }).from(alerts).where(eq(alerts.unsubscribeToken, input.data.token));
  if (!row) { res.status(404).json({ error: "Unsubscribe link not found" }); return; }
  res.json(GetAvailabilityUnsubscribeResponse.parse(row));
});

router.post("/availability-email/unsubscribe", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const input = UnsubscribeAvailabilityEmailBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid unsubscribe link" }); return; }
  // The unguessable capability grants only this one action; no user or saved-search data is returned.
  const [row] = await db.update(alerts).set({ emailEnabled: false }).where(eq(alerts.unsubscribeToken, input.data.token)).returning({ emailEnabled: alerts.emailEnabled });
  if (!row) { res.status(404).json({ error: "Unsubscribe link not found" }); return; }
  res.json(UnsubscribeAvailabilityEmailResponse.parse(row));
});

export default router;
