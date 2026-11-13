import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lte, ne, or, sql } from "drizzle-orm";
import {
  db, pool, availabilityAlertsTable as alerts, availabilityMatchesTable as matches,
  availabilityEvaluationsTable as evaluations, conversationsTable, messagesTable, listingsTable,
  type AvailabilityAlertRow, type AvailabilityMatchRow,
} from "@workspace/db";
import type { AlertCriteria, AvailabilityCard } from "@workspace/api-zod";
import { eligiblePurchase, type SearchListing } from "./search-criteria";
import { visualMatches } from "./photo-matching";
import { withPhotoBudget } from "./photo-ai";
import { accountEmail, deliverAvailabilityEmail, emailMode, MailDeliveryError } from "./availability-mail";
import { logger } from "./logger";

export const BAQI_SYSTEM_ID = "__baqi_system__";
export const BAQI_ALERT_THREAD = "__baqi_availability__";
export const listingSignature = (row: SearchListing) => createHash("sha256").update(JSON.stringify(row)).digest("hex");
type Dependencies = {
  emailLookup?: typeof accountEmail;
  deliver?: typeof deliverAvailabilityEmail;
  visual?: typeof visualMatches;
  onlyAlertIds?: string[];
};

/** Match, message and conversation commit atomically. Unique constraints arbitrate competing workers. */
export async function recordAvailabilityMatch(alertId: string, expected: SearchListing, visual: boolean) {
  return db.transaction(async (tx) => {
    const [alert] = await tx.select().from(alerts).where(eq(alerts.id, alertId)).for("update");
    if (!alert || alert.status !== "active") return false;
    const [row] = await tx.select().from(listingsTable).where(eq(listingsTable.id, expected.id)).for("update");
    if (!row || listingSignature(row) !== listingSignature(expected)) return false;
    const criteria = alert.criteria as AlertCriteria;
    const purchase = eligiblePurchase(row, criteria, alert.buyerId);
    if (!purchase || (!!criteria.objectPath && !visual)) return false;
    const num = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 3 });
    const explanation = `${visual ? "لقينا إعلان يشبه الصورة اللي أرسلتها" : `لقينا إعلان يناسب طلبك: ${row.title}`}.${
      purchase.requestedQuantity !== null ? ` طلبت ${num(purchase.requestedQuantity)} ${row.unit}،` : ""
    } المتاح ${num(row.quantity)} ${row.unit} في حي ${row.neighborhood}.${criteria.dimensions ? ` المقاس المعلن: ${criteria.dimensions}.` : ""}`;
    const snapshot: AvailabilityCard = {
      alertId, listingId: row.id, title: row.title, photo: row.photos[0] ?? null,
      quantity: row.quantity, unit: row.unit, neighborhood: row.neighborhood, isFree: row.isFree,
      unitPrice: row.unitPrice, saleMode: row.saleMode as "partial" | "full_lot",
      available: true, alertStatus: "active", visual, ...purchase,
    };
    const [match] = await tx.insert(matches).values({
      id: randomUUID(), alertId, listingId: row.id, snapshot: { ...snapshot }, explanation,
      emailStatus: alert.emailEnabled ? "pending" : "skipped",
    }).onConflictDoNothing({ target: [matches.alertId, matches.listingId] }).returning();
    if (!match) return false;
    await tx.insert(conversationsTable).values({
      id: randomUUID(), buyerId: alert.buyerId, sellerId: BAQI_SYSTEM_ID,
      listingId: BAQI_ALERT_THREAD, kind: "availability",
    }).onConflictDoNothing({ target: [conversationsTable.listingId, conversationsTable.buyerId] });
    const [conversation] = await tx.select().from(conversationsTable).where(and(
      eq(conversationsTable.listingId, BAQI_ALERT_THREAD), eq(conversationsTable.buyerId, alert.buyerId),
    ));
    await tx.insert(messagesTable).values({
      id: randomUUID(), conversationId: conversation.id, senderId: BAQI_SYSTEM_ID,
      senderName: "تنبيهات باقي", content: explanation, availabilityMatchId: match.id,
    });
    await tx.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversation.id));
    return true;
  });
}

async function scanAlert(alert: AvailabilityAlertRow, rows: SearchListing[], deps: Dependencies) {
  const criteria = alert.criteria as AlertCriteria;
  const recorded = await db.select({ id: matches.listingId }).from(matches).where(eq(matches.alertId, alert.id));
  const already = new Set(recorded.map((r) => r.id));
  const candidates = rows.filter((row) => !already.has(row.id) && eligiblePurchase(row, criteria, alert.buyerId));
  let visualCalls = 0;
  for (const row of candidates) {
    if (!criteria.objectPath) { await recordAvailabilityMatch(alert.id, row, false); continue; }
    if (!row.photos.length || visualCalls >= 5) continue;
    const signature = listingSignature(row);
    // A lease is durable across process crashes; unchanged negative comparisons are never repeatedly billed.
    const [claim] = await db.insert(evaluations).values({
      id: randomUUID(), alertId: alert.id, listingId: row.id, signature,
      status: "processing", nextAt: new Date(Date.now() + 180_000),
    }).onConflictDoUpdate({
      target: [evaluations.alertId, evaluations.listingId],
      set: { signature, status: "processing", nextAt: new Date(Date.now() + 180_000) },
      setWhere: or(ne(evaluations.signature, signature), and(ne(evaluations.status, "complete"), lte(evaluations.nextAt, new Date()))),
    }).returning();
    if (!claim) continue;
    visualCalls++;
    try {
      const result = await withPhotoBudget(alert.buyerId, () => (deps.visual ?? visualMatches)(criteria.objectPath!, alert.buyerId, [row]));
      if (result.some((r) => r.id === row.id)) await recordAvailabilityMatch(alert.id, row, true);
      await db.update(evaluations).set({ status: "complete" }).where(and(eq(evaluations.id, claim.id), eq(evaluations.signature, signature)));
    } catch {
      await db.update(evaluations).set({ status: "retry", nextAt: new Date(Date.now() + 60_000) })
        .where(and(eq(evaluations.id, claim.id), eq(evaluations.signature, signature)));
      logger.warn("Saved-search visual comparison deferred; no visual match was assumed");
    }
  }
}

export async function processAvailabilityEmails(deps: Dependencies = {}) {
  const pendingStates = ["pending", "retry", "pending_verification", "blocked_configuration", "sending"];
  const due = await db.select({ id: matches.id, alertId: matches.alertId }).from(matches).where(and(
    inArray(matches.emailStatus, pendingStates),
    lte(matches.emailNextAt, new Date()),
    ...(deps.onlyAlertIds ? [inArray(matches.alertId, deps.onlyAlertIds)] : []),
  )).orderBy(asc(matches.emailNextAt)).limit(50);
  for (const item of due) {
    // Commit the send attempt and lease BEFORE contacting a provider. A process crash after
    // acceptance therefore cannot erase our knowledge that the idempotency window started.
    const lease = randomUUID();
    const claimed = await db.transaction(async (tx) => {
      // Always lock the alert before the match, matching the inventory-emission lock order.
      const [alert] = await tx.select().from(alerts).where(eq(alerts.id, item.alertId)).for("update", { skipLocked: true });
      if (!alert) return false;
      const [match] = await tx.select().from(matches).where(eq(matches.id, item.id)).for("update", { skipLocked: true });
      if (!match || !pendingStates.includes(match.emailStatus) || match.emailNextAt > new Date()) return false;
      const defer = async (status: string, error: string | null = null) => {
        await tx.update(matches).set({ emailStatus: status, emailError: error, emailNextAt: new Date(Date.now() + 60_000) }).where(eq(matches.id, match.id));
        return false;
      };
      if (alert.status !== "active" || !alert.emailEnabled) return defer("skipped");
      if (!deps.deliver && emailMode() === "unavailable") return defer("blocked_configuration", "configuration_missing");
      try {
        const account = await (deps.emailLookup ?? accountEmail)(alert.buyerId);
        if (!account.verified || !account.address) return defer("pending_verification");
        if (match.emailRecipient && match.emailRecipient !== account.address) return defer("skipped", "verified_primary_address_changed");
        if (match.emailFirstAttemptAt && Date.now() - match.emailFirstAttemptAt.getTime() > 23 * 60 * 60_000) return defer("uncertain", "idempotency_window_expired");
        if (match.emailAttempts >= 8) return defer("failed", "attempt_limit_reached");
        await tx.update(matches).set({
          emailStatus: "sending", emailLeaseToken: lease, emailRecipient: account.address,
          emailFirstAttemptAt: match.emailFirstAttemptAt ?? new Date(),
          emailAttempts: match.emailAttempts + 1, emailNextAt: new Date(Date.now() + 120_000),
        }).where(eq(matches.id, match.id));
        return true;
      } catch { return defer("retry", "account_verification_unavailable"); }
    });
    if (!claimed) continue;
    await db.transaction(async (tx) => {
      // Holding the alert lock gives pause, delete and unsubscribe a clear ordering with a send.
      const [alert] = await tx.select().from(alerts).where(eq(alerts.id, item.alertId)).for("update");
      const [match] = await tx.select().from(matches).where(eq(matches.id, item.id)).for("update");
      if (!match || match.emailStatus !== "sending" || match.emailLeaseToken !== lease) return;
      if (!alert || alert.status !== "active" || !alert.emailEnabled) {
        await tx.update(matches).set({ emailStatus: "skipped", emailLeaseToken: null }).where(eq(matches.id, match.id));
        return;
      }
      let status: string, providerId: string | null = null, error: string | null = null;
      try {
        const account = await (deps.emailLookup ?? accountEmail)(alert.buyerId);
        if (!account.verified || !account.address) {
          status = "pending_verification";
        } else if (account.address !== match.emailRecipient) {
          status = "skipped"; error = "verified_primary_address_changed";
        } else {
          const result = await (deps.deliver ?? deliverAvailabilityEmail)(match, account.address, alert.unsubscribeToken, tx);
          status = result.status; providerId = result.providerId;
        }
      } catch (err) {
        const mailError = err instanceof MailDeliveryError ? err : new MailDeliveryError(true, "account_or_delivery_unavailable");
        error = mailError.code;
        if (error === "configuration_missing") status = "blocked_configuration";
        else status = mailError.retryable && match.emailAttempts < 8 ? "retry" : "failed";
      }
      await tx.update(matches).set({
        emailStatus: status, emailProviderId: providerId, emailError: error, emailLeaseToken: null,
        emailNextAt: new Date(Date.now() + (status === "retry" ? Math.min(60_000 * 2 ** Math.max(0, match.emailAttempts - 1), 3_600_000) : 60_000)),
      }).where(eq(matches.id, match.id));
    });
  }
}

export async function runAvailabilitySweep(deps: Dependencies = {}) {
  const active = await db.select().from(alerts).where(and(eq(alerts.status, "active"),
    ...(deps.onlyAlertIds ? [inArray(alerts.id, deps.onlyAlertIds)] : [])));
  if (active.length) {
    const rows = await db.select().from(listingsTable).where(and(eq(listingsTable.isAvailable, true), gt(listingsTable.quantity, 0)));
    for (const alert of active) await scanAlert(alert, rows, deps);
  }
  await processAvailabilityEmails(deps);
}

let running = false;
let rerun = false;
export function wakeAvailabilityWorker() {
  if (running) { rerun = true; return; }
  running = true;
  void (async () => {
    do {
      rerun = false;
      const connection = await pool.connect();
      let acquired = false;
      try {
        // Session-scoped lock bounds AI work across multiple API instances; it releases on a crash.
        const lock = await connection.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(287681, 1) AS acquired");
        acquired = lock.rows[0].acquired;
        if (acquired) await runAvailabilitySweep();
      }
      catch { logger.error("Availability-alert sweep failed; persistent inventory and outbox will be retried"); }
      finally {
        if (acquired) await connection.query("SELECT pg_advisory_unlock(287681, 1)").catch(() => undefined);
        connection.release();
      }
    } while (rerun);
  })().catch(() => { logger.error("Availability worker could not acquire a database connection; the next scheduled sweep will retry"); })
    .finally(() => { running = false; });
}

export function startAvailabilityWorker() {
  const timer = setInterval(wakeAvailabilityWorker, 15_000);
  timer.unref();
  wakeAvailabilityWorker();
}

export async function availabilityCard(match: AvailabilityMatchRow): Promise<AvailabilityCard> {
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, match.listingId));
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, match.alertId));
  const card = match.snapshot as unknown as AvailabilityCard;
  return {
    ...card,
    ...(listing ? { title: listing.title, photo: listing.photos[0] ?? null, quantity: listing.quantity, neighborhood: listing.neighborhood,
      unitPrice: listing.unitPrice, isFree: listing.isFree, saleMode: listing.saleMode as "partial" | "full_lot" } : {}),
    available: !!listing && listing.isAvailable && listing.quantity > 0,
    alertStatus: alert?.status === "active" ? "active" : alert?.status === "paused" ? "paused" : "deleted",
  };
}
