import { pgTable, text, uuid, boolean, timestamp, json, index, geometry } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const officesTable = pgTable("offices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  phone: text("phone"),
  // Single pin marking where the office physically is — distinct from the
  // polygon boundary below (which is the area it serves, not a point).
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  polygonGeoJson: json("polygon_geo_json"),
  geom: geometry("geom", { type: "polygon", srid: 4326 }), // see beats.ts — same additive PostGIS pattern
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("offices_geom_idx").using("gist", table.geom),
]);

export const insertOfficeSchema = createInsertSchema(officesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOffice = z.infer<typeof insertOfficeSchema>;
export type Office = typeof officesTable.$inferSelect;

// Many-to-many: admins to offices
export const userOfficesTable = pgTable("user_offices", {
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  officeId: uuid("office_id").notNull().references(() => officesTable.id, { onDelete: "cascade" }),
});
