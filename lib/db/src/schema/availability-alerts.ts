import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const availabilityAlertsTable = pgTable("baqi_availability_alerts", {
  id: text("id").primaryKey(),
  buyerId: text("buyer_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("baqi_alert_buyer_fingerprint").on(t.buyerId, t.fingerprint)]);

export const availabilityMatchesTable = pgTable("baqi_availability_matches", {
  id: text("id").primaryKey(),
  alertId: text("alert_id").notNull().references(() => availabilityAlertsTable.id),
  listingId: text("listing_id").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  explanation: text("explanation").notNull(),
  emailStatus: text("email_status").notNull().default("pending"),
  emailAttempts: integer("email_attempts").notNull().default(0),
  emailError: text("email_error"),
  emailProviderId: text("email_provider_id"),
  emailFirstAttemptAt: timestamp("email_first_attempt_at", { withTimezone: true }),
  emailLeaseToken: text("email_lease_token"),
  emailRecipient: text("email_recipient"),
  emailNextAt: timestamp("email_next_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("baqi_alert_listing_match").on(t.alertId, t.listingId)]);

export const availabilityEvaluationsTable = pgTable("baqi_availability_evaluations", {
  id: text("id").primaryKey(),
  alertId: text("alert_id").notNull(),
  listingId: text("listing_id").notNull(),
  signature: text("signature").notNull(),
  status: text("status").notNull(),
  nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("baqi_alert_listing_evaluation").on(t.alertId, t.listingId)]);

// Local adapter captures are private database rows, never public files or API responses.
export const availabilityLocalMailTable = pgTable("baqi_availability_local_mail", {
  matchId: text("match_id").primaryKey().references(() => availabilityMatchesTable.id),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  testUrl: text("test_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAvailabilityAlertSchema = createInsertSchema(availabilityAlertsTable);
export const insertAvailabilityMatchSchema = createInsertSchema(availabilityMatchesTable);
export type InsertAvailabilityAlert = z.infer<typeof insertAvailabilityAlertSchema>;
export type AvailabilityAlertRow = typeof availabilityAlertsTable.$inferSelect;
export type AvailabilityMatchRow = typeof availabilityMatchesTable.$inferSelect;
