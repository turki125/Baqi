import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const conversationsTable = pgTable(
  "baqi_conversations",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id").notNull(),
    buyerId: text("buyer_id").notNull(),
    sellerId: text("seller_id").notNull(),
    kind: text("kind").notNull().default("listing"),
    buyerReadAt: timestamp("buyer_read_at", { withTimezone: true }),
    sellerReadAt: timestamp("seller_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("baqi_conversation_listing_buyer").on(table.listingId, table.buyerId)],
);

export const messagesTable = pgTable("baqi_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  availabilityMatchId: text("availability_match_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable);
export const insertMessageSchema = createInsertSchema(messagesTable);
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
