import { createInsertSchema } from "drizzle-zod";
import { boolean, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const ordersTable = pgTable("baqi_orders", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  listingTitle: text("listing_title").notNull(),
  buyerId: text("buyer_id").notNull(),
  sellerId: text("seller_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
  unit: text("unit").notNull(),
  total: numeric("total", { precision: 12, scale: 2, mode: "number" }).notNull(),
  depositDue: numeric("deposit_due", { precision: 12, scale: 2, mode: "number" }).notNull(),
  balanceDue: numeric("balance_due", { precision: 12, scale: 2, mode: "number" }).notNull(),
  status: text("status").notNull(),
  paymentMethod: text("payment_method"),
  depositPaid: boolean("deposit_paid").notNull().default(false),
  balancePaid: boolean("balance_paid").notNull().default(false),
  receiptConfirmed: boolean("receipt_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
