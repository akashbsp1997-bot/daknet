import { pgTable, text, uuid, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { officesTable } from "./offices";
import { usersTable } from "./users";

export const articlesTable = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcode: text("barcode").notNull().unique(),
  articleNumber: text("article_number").notNull(),
  addressee: text("addressee").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("pending"), // pending, delivered, attempted, returned
  deliveryReason: text("delivery_reason"),
  operatorId: uuid("operator_id").references(() => usersTable.id, { onDelete: "set null" }),
  officeId: uuid("office_id").notNull().references(() => officesTable.id, { onDelete: "cascade" }),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  requiresSignature: boolean("requires_signature").notNull().default(false),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  isCod: boolean("is_cod").notNull().default(false),
  codAmount: real("cod_amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertArticleSchema = createInsertSchema(articlesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
