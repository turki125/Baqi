import { createInsertSchema } from "drizzle-zod";
import { boolean, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const listingsTable = pgTable("baqi_listings", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull(),
  sellerName: text("seller_name").notNull().default("Baqi seller"),
  sellerTrusted: boolean("seller_trusted").notNull().default(false),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: text("category_id").notNull(),
  condition: text("condition").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2, mode: "number" }),
  isFree: boolean("is_free").notNull().default(false),
  neighborhood: text("neighborhood").notNull(),
  pickupDetails: text("pickup_details").notNull(),
  mapUrl: text("map_url"),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  phone: text("phone"),
  phoneVisible: boolean("phone_visible").notNull().default(false),
  saleMode: text("sale_mode").notNull().default("partial"),
  minimumIncrement: numeric("minimum_increment", { precision: 12, scale: 3, mode: "number" }).notNull().default(1),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
