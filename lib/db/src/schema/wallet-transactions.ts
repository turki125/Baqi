import { createInsertSchema } from "drizzle-zod";
import { numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const walletTransactionsTable = pgTable(
  "baqi_wallet_transactions",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id").notNull(),
    orderId: text("order_id"),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    status: text("status").notNull(),
    description: text("description").notNull(),
    destination: text("destination"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("baqi_wallet_order_once").on(table.orderId)],
);

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ createdAt: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
