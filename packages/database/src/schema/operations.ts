import { pgTable, text, uuid, boolean, timestamp, real, integer, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { officesTable } from "./offices";
import { usersTable } from "./users";
import { beatsTable, addressesTable } from "./beats";

export const visitsTable = pgTable("visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  officeId: uuid("office_id").notNull().references(() => officesTable.id, { onDelete: "cascade" }),
  beatId: uuid("beat_id").references(() => beatsTable.id, { onDelete: "set null" }),
  addressId: uuid("address_id").references(() => addressesTable.id, { onDelete: "set null" }),
  visitType: text("visit_type").notNull(), // delivery, enquiry, lead, complaint, pickup, business_proposal, beat_update, office_work, verification, money_collection, other
  gpsLat: real("gps_lat").notNull(),
  gpsLng: real("gps_lng").notNull(),
  visitTimestamp: timestamp("visit_timestamp", { withTimezone: true }).notNull(),
  notes: text("notes"),
  contactNumber: text("contact_number"),

  // --- Delivery signature (govt-service-backed, replaces a wet-ink signature) ---
  // Nullable throughout: only delivery-type visits carry this, and only once
  // the recipient actually completes verification. "method" is a plain string
  // (not a fixed enum) because it names WHICH free govt service confirmed the
  // recipient — "digilocker" today, e.g. "aadhaar_esign" later — without a
  // schema change to add one. A visit with no method recorded simply has no
  // digital signature on file (photo evidence + gpsLat/gpsLng may still exist
  // independently via visitPhotosTable, e.g. for recipients without any of
  // these govt services available to them).
  verificationMethod: text("verification_method"),
  verifiedRecipientName: text("verified_recipient_name"),
  verifiedRecipientMobile: text("verified_recipient_mobile"),
  verificationTxnId: text("verification_txn_id"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationRawResponse: json("verification_raw_response"), // simulated gateway payload, kept for audit

  isSynced: boolean("is_synced").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVisitSchema = createInsertSchema(visitsTable).omit({
  id: true,
  createdAt: true,
  // Signature fields are only ever set by the dedicated verify-delivery
  // action below, never through the general create/update visit form.
  verificationMethod: true,
  verifiedRecipientName: true,
  verifiedRecipientMobile: true,
  verificationTxnId: true,
  verifiedAt: true,
  verificationRawResponse: true,
});
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visitsTable.$inferSelect;

// Payload for the "sign delivery" action — separate from the general visit
// insert/update path above, mirrors digilockerVerificationSchema in beats.ts.
export const deliverySignatureSchema = z.object({
  visitId: z.string().uuid(),
  method: z.enum(["digilocker", "aadhaar_esign"]),
  verifiedName: z.string().min(1),
  verifiedMobile: z.string().min(10).max(15),
  txnId: z.string().min(1),
  rawResponse: z.unknown().optional(),
});
export type DeliverySignature = z.infer<typeof deliverySignatureSchema>;

// --- Photo evidence ---
// Attached to visits (not addresses): addressId on a visit is nullable
// (leads/enquiries may have no registered address yet), a visit is the
// actual event being proven, and one visit can carry more than one photo.
export const visitPhotosTable = pgTable("visit_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id").notNull().references(() => visitsTable.id, { onDelete: "cascade" }),

  // Populated once the file lands in object storage (S3 / Cloudflare R2 /
  // Supabase Storage / Vercel Blob — pick one; Neon shouldn't hold the
  // image bytes directly).
  photoUrl: text("photo_url").notNull(),

  // Capture-time geotag, kept separate from visitsTable.gpsLat/gpsLng since
  // the photo can be taken moments apart from the visit's own GPS ping.
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  digipin: text("digipin"), // computed the same way as addressesTable.digipin

  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  isSynced: boolean("is_synced").notNull().default(true), // mirrors visitsTable's offline-first pattern

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("visit_photos_visit_idx").on(table.visitId),
]);

export const insertVisitPhotoSchema = createInsertSchema(visitPhotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVisitPhoto = z.infer<typeof insertVisitPhotoSchema>;
export type VisitPhoto = typeof visitPhotosTable.$inferSelect;

export const operatorLocationsTable = pgTable("operator_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gpsLat: real("gps_lat").notNull(),
  gpsLng: real("gps_lng").notNull(),
  batteryLevel: integer("battery_level"),
  isOnline: boolean("is_online").notNull().default(true),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOperatorLocationSchema = createInsertSchema(operatorLocationsTable).omit({
  id: true,
  recordedAt: true,
});
export type InsertOperatorLocation = z.infer<typeof insertOperatorLocationSchema>;
export type OperatorLocation = typeof operatorLocationsTable.$inferSelect;
