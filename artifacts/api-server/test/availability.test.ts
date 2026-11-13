import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { and, eq, inArray, like } from "drizzle-orm";
import {
  db, pool, listingsTable, availabilityAlertsTable as alerts, availabilityMatchesTable as matches,
  availabilityEvaluationsTable as evaluations, availabilityLocalMailTable as mail, conversationsTable, messagesTable,
} from "@workspace/db";
import type { AlertCriteria } from "@workspace/api-zod";
import { criteriaFromSearch, criteriaFingerprint, eligiblePurchase, dimensionKeys, type SearchListing } from "../src/lib/search-criteria";
import { recordAvailabilityMatch, runAvailabilitySweep, processAvailabilityEmails, availabilityCard } from "../src/lib/availability-engine";
import { deliverAvailabilityEmail, MailDeliveryError, renderAvailabilityEmail, emailMode } from "../src/lib/availability-mail";
import { VISUAL_MATCH_THRESHOLD } from "../src/lib/photo-matching";

process.env.ALERT_EMAIL_ADAPTER = "local";
const prefix = `alert-test-${randomUUID()}`;
const buyer = `${prefix}-buyer`, seller = `${prefix}-seller`;
const fixtures: string[] = [];
// Exclude background sweeps while these isolated fixtures exercise the engine directly.
const workerLock = await pool.connect();
await workerLock.query("SELECT pg_advisory_lock(287681, 1)");
function listing(overrides: Partial<SearchListing> = {}): SearchListing {
  return {
    id: `${prefix}-${randomUUID()}`, sellerId: seller, sellerName: "Test seller", sellerTrusted: false,
    title: "بلاط بيج 60×60", description: `بلاط بيج مطفي جديد متاح في الرياض ${prefix}`, categoryId: "tiles", condition: "new",
    quantity: 10, unit: "m²", unitPrice: 20, isFree: false, neighborhood: "الياسمين", pickupDetails: "Test local pickup",
    mapUrl: null, photos: ["/demo-tiles.jpg"], phone: null, phoneVisible: false, saleMode: "partial", minimumIncrement: 1,
    isAvailable: true, createdAt: new Date(), ...overrides,
  };
}
const request = criteriaFromSearch({ q: "أحتاج ٨ م² بلاط بيج ٦٠×٦٠ في الرياض" });
const inventory: string[] = [];
async function addListing(overrides: Partial<SearchListing> = {}) {
  const row = listing(overrides); inventory.push(row.id);
  await db.insert(listingsTable).values(row); return row;
}
async function addAlert(criteria: AlertCriteria = request, emailEnabled = true) {
  criteria = { ...criteria, keywords: [criteria.keywords, prefix].filter(Boolean).join(" ") };
  const id = `${prefix}-${randomUUID()}`; fixtures.push(id);
  const [row] = await db.insert(alerts).values({
    id, buyerId: buyer, fingerprint: `${criteriaFingerprint(criteria)}-${id}`, criteria: { ...criteria },
    emailEnabled, unsubscribeToken: randomBytes(32).toString("hex"),
  }).returning();
  return row;
}
const lookup = async () => ({ address: "verified-local-inbox@example.test", verified: true });
async function countMatches(alertId: string) { return (await db.select().from(matches).where(eq(matches.alertId, alertId))).length; }
after(async () => {
  const rows = await db.select({ id: matches.id }).from(matches).where(inArray(matches.alertId, fixtures));
  const conv = await db.select({ id: conversationsTable.id }).from(conversationsTable).where(eq(conversationsTable.buyerId, buyer));
  if (rows.length) await db.delete(mail).where(inArray(mail.matchId, rows.map((m) => m.id)));
  if (conv.length) await db.delete(messagesTable).where(inArray(messagesTable.conversationId, conv.map((c) => c.id)));
  await db.delete(conversationsTable).where(eq(conversationsTable.buyerId, buyer));
  await db.delete(evaluations).where(inArray(evaluations.alertId, fixtures));
  await db.delete(matches).where(inArray(matches.alertId, fixtures));
  await db.delete(alerts).where(inArray(alerts.id, fixtures));
  await db.delete(listingsTable).where(inArray(listingsTable.id, inventory));
  await workerLock.query("SELECT pg_advisory_unlock(287681, 1)");
  workerLock.release();
  await pool.end();
});

test("Arabic supplied criteria, equivalent units/dimensions and no invented constraints", () => {
  assert.equal(request.quantity, 8); assert.equal(request.unit, "m²"); assert.equal(request.dimensions, "60×60");
  assert.equal(request.material, "tiles"); assert.equal(request.color, "beige");
  assert.equal(request.budget, undefined); assert.equal(request.neighborhood, undefined); assert.equal(request.keywords, undefined);
  assert.deepEqual(criteriaFromSearch({ q: "بيج" }), { requestText: "بيج", color: "beige" });
  assert.deepEqual(dimensionKeys("600×600 mm"), ["60×60"]);
  assert.equal(criteriaFingerprint({ ...request, quantity: 80000, unit: "cm²", dimensions: "600×600 mm" }), criteriaFingerprint(request));
  assert.equal(criteriaFingerprint({ ...request, material: "بلاط", color: "بيج", requestText: "another wording" }), criteriaFingerprint(request));
});
test("single-listing stock, whole boxes/lots, budget, specifications, neighborhood and own-stock exclusions", () => {
  assert.equal(eligiblePurchase(listing({ quantity: 5 }), request), null);
  assert.equal(eligiblePurchase(listing({ title: "بلاط بيج 30×30" }), request), null);
  assert.equal(eligiblePurchase(listing({ sellerId: buyer }), request, buyer), null);
  assert.equal(eligiblePurchase(listing({ neighborhood: "الملقا" }), { ...request, neighborhood: "الياسمين" }), null);
  assert.ok(eligiblePurchase(listing({ neighborhood: "Al Yasmin" }), { ...request, neighborhood: "الياسمين" }));
  assert.equal(eligiblePurchase(listing(), { ...request, freeOnly: true }), null);
  assert.equal(eligiblePurchase(listing({ saleMode: "full_lot" }), { ...request, budget: 180 }), null);
  assert.equal(eligiblePurchase(listing({ minimumIncrement: 1.44 }), { ...request, budget: 170 }), null);
  assert.equal(eligiblePurchase(listing({ minimumIncrement: 1.44 }), { ...request, budget: 180 })?.purchaseQuantity, 8.64);
  assert.equal(eligiblePurchase(listing({ unit: "box" }), request), null);
  assert.equal(eligiblePurchase(listing({ quantity: 80000, unit: "cm²", minimumIncrement: 10000, unitPrice: .002 }), { ...request, budget: 160 })?.totalPrice, 160);
  assert.equal(eligiblePurchase(listing({ title: "بلاط بيج 60×60 model X2" }), { ...request, model: "X1" }), null);
});
test("durable single match/message/email and one official conversation across simultaneous updates and searches", async () => {
  const alert = await addAlert(), a = await addListing({ quantity: 5 }), b = await addListing({ quantity: 5 });
  await runAvailabilitySweep({ onlyAlertIds: [alert.id], emailLookup: lookup });
  assert.equal(await countMatches(alert.id), 0, "two 5m² listings never pool into 8m²");
  await db.update(listingsTable).set({ quantity: 10 }).where(eq(listingsTable.id, a.id));
  a.quantity = 10;
  await Promise.all(Array.from({ length: 8 }, () => recordAvailabilityMatch(alert.id, a, false)));
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup });
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup });
  assert.equal(await countMatches(alert.id), 1);
  const [match] = await db.select().from(matches).where(eq(matches.alertId, alert.id));
  assert.equal(match.emailStatus, "local_captured");
  const captured = await db.select().from(mail).where(eq(mail.matchId, match.id));
  assert.equal(captured.length, 1); assert.match(captured[0].html, /dir="rtl"/); assert.match(captured[0].html, /نسخة اختبار محلية/);
  assert.ok(captured[0].html.includes(`/listing/${a.id}`)); assert.ok(captured[0].html.includes("/email-unsubscribe?token="));
  const second = await addAlert({ ...request, neighborhood: "الملقا" }, false);
  const other = await addListing({ neighborhood: "الملقا" });
  await recordAvailabilityMatch(second.id, other, false);
  const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.buyerId, buyer));
  assert.equal(conv.length, 1); assert.equal(conv[0].kind, "availability");
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conv[0].id));
  assert.equal(msgs.length, 2); assert.ok(msgs.every((m) => m.senderId === "__baqi_system__"));
  assert.equal(await countMatches(second.id), 1);
  await db.update(listingsTable).set({ quantity: 0, isAvailable: false }).where(eq(listingsTable.id, a.id));
  assert.equal((await availabilityCard(match)).available, false);
  // Keep this test's other stock from interfering with later scenario sweeps.
  await db.update(listingsTable).set({ isAvailable: false }).where(inArray(listingsTable.id, [b.id, other.id]));
});
test("pausing, resuming, unsubscribe and verified-email gating preserve Messages independently", async () => {
  const alert = await addAlert();
  await db.update(alerts).set({ status: "paused" }).where(eq(alerts.id, alert.id));
  const row = await addListing();
  assert.equal(await recordAvailabilityMatch(alert.id, row, false), false);
  await db.update(alerts).set({ status: "active" }).where(eq(alerts.id, alert.id));
  await runAvailabilitySweep({ onlyAlertIds: [alert.id], emailLookup: async () => ({ address: "pending@example.test", verified: false }) });
  assert.equal(await countMatches(alert.id), 1);
  const [first] = await db.select().from(matches).where(eq(matches.alertId, alert.id));
  assert.equal(first.emailStatus, "pending_verification");
  await db.update(matches).set({ emailNextAt: new Date(0) }).where(eq(matches.id, first.id));
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup });
  assert.equal((await db.select().from(matches).where(eq(matches.id, first.id)))[0].emailStatus, "local_captured");
  await db.update(alerts).set({ emailEnabled: false }).where(eq(alerts.unsubscribeToken, alert.unsubscribeToken));
  const next = await addListing();
  await recordAvailabilityMatch(alert.id, next, false);
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup });
  assert.equal(await countMatches(alert.id), 2);
  const [second] = await db.select().from(matches).where(and(eq(matches.alertId, alert.id), eq(matches.listingId, next.id)));
  assert.equal(second.emailStatus, "skipped");
  assert.equal((await db.select().from(mail).where(eq(mail.matchId, second.id))).length, 0);
  await db.update(listingsTable).set({ isAvailable: false }).where(inArray(listingsTable.id, [row.id, next.id]));
});
test("temporary mail failure retries once without losing or duplicating the inbox message", async () => {
  const alert = await addAlert(), row = await addListing();
  await recordAvailabilityMatch(alert.id, row, false);
  let attempts = 0;
  const deliver: typeof deliverAvailabilityEmail = async (...args) => {
    attempts++; if (attempts === 1) throw new MailDeliveryError(true, "simulated_http_503");
    return deliverAvailabilityEmail(...args);
  };
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup, deliver });
  const [match] = await db.select().from(matches).where(eq(matches.alertId, alert.id));
  assert.equal(match.emailStatus, "retry");
  assert.equal((await db.select().from(messagesTable).where(eq(messagesTable.availabilityMatchId, match.id))).length, 1);
  await db.update(matches).set({ emailNextAt: new Date(0) }).where(eq(matches.id, match.id));
  await Promise.all([processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup, deliver }), processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup, deliver })]);
  assert.equal(attempts, 2);
  assert.equal((await db.select().from(mail).where(eq(mail.matchId, match.id))).length, 1);
  await db.update(listingsTable).set({ isAvailable: false }).where(eq(listingsTable.id, row.id));
});
test("visual gate requires 0.55 matcher and confirmed dimensions independently; escaped email content", async () => {
  assert.equal(VISUAL_MATCH_THRESHOLD, .55);
  const alert = await addAlert({ ...request, objectPath: "/objects/uploads/test-reference" }, false);
  const wrong = await addListing({ title: "بلاط بيج 30×30" });
  assert.equal(await recordAvailabilityMatch(alert.id, wrong, true), false);
  const right = await addListing();
  assert.equal(await recordAvailabilityMatch(alert.id, right, false), false, "photo alerts cannot be emitted without visual analysis");
  assert.equal(await recordAvailabilityMatch(alert.id, right, true), true);
  const [match] = await db.select().from(matches).where(eq(matches.alertId, alert.id));
  assert.match(match.explanation, /لقينا إعلان يشبه الصورة اللي أرسلتها/);
  const rendered = renderAvailabilityEmail({ ...match, explanation: "<script>bad</script>" }, alert.unsubscribeToken, "https://baqi-alerts.test", true);
  assert.ok(!rendered.html.includes("<script>")); assert.match(rendered.html, /&lt;script&gt;/);
});
test("crashed-send lease recovers safely and expired idempotency windows never resend", async () => {
  const alert = await addAlert(), row = await addListing();
  await recordAvailabilityMatch(alert.id, row, false);
  const [match] = await db.select().from(matches).where(eq(matches.alertId, alert.id));
  // A durable claim survived a process crash. The lease expired; the provider key is still usable.
  await db.update(matches).set({
    emailStatus: "sending", emailLeaseToken: "crashed-worker", emailAttempts: 1,
    emailRecipient: "verified-local-inbox@example.test", emailFirstAttemptAt: new Date(),
    emailNextAt: new Date(0),
  }).where(eq(matches.id, match.id));
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup });
  assert.equal((await db.select().from(matches).where(eq(matches.id, match.id)))[0].emailStatus, "local_captured");
  const lateRow = await addListing();
  await recordAvailabilityMatch(alert.id, lateRow, false);
  const [late] = await db.select().from(matches).where(and(eq(matches.alertId, alert.id), eq(matches.listingId, lateRow.id)));
  await db.update(matches).set({
    emailStatus: "sending", emailLeaseToken: "expired-worker", emailAttempts: 1,
    emailRecipient: "verified-local-inbox@example.test",
    emailFirstAttemptAt: new Date(Date.now() - 25 * 60 * 60_000), emailNextAt: new Date(0),
  }).where(eq(matches.id, late.id));
  let calls = 0;
  await processAvailabilityEmails({ onlyAlertIds: [alert.id], emailLookup: lookup, deliver: async (...args) => { calls++; return deliverAvailabilityEmail(...args); } });
  assert.equal(calls, 0);
  assert.equal((await db.select().from(matches).where(eq(matches.id, late.id)))[0].emailStatus, "uncertain");
});
