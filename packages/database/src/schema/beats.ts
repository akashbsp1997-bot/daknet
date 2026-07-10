import { pgTable, text, uuid, boolean, timestamp, json, index, geometry } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { officesTable } from "./offices";
import { usersTable } from "./users";

export const beatsTable = pgTable("beats", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  officeId: uuid("office_id").notNull().references(() => officesTable.id, { onDelete: "cascade" }),
  operatorId: uuid("operator_id").references(() => usersTable.id, { onDelete: "set null" }),
  polygonGeoJson: json("polygon_geo_json"),

  // --- PostGIS ---
  // Additive: polygonGeoJson stays as the source of truth for now. `geom` is
  // backfilled from it (see the one-time SQL in the PR/PostGIS notes) and is
  // what spatial queries (ST_Contains, etc.) actually run against — Postgres
  // can use a GiST index on this; it can't index a plain json column the
  // same way. Requires the postgis extension enabled on the database first.
  geom: geometry("geom", { type: "polygon", srid: 4326 }),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("beats_geom_idx").using("gist", table.geom),
]);

export const insertBeatSchema = createInsertSchema(beatsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBeat = z.infer<typeof insertBeatSchema>;
export type Beat = typeof beatsTable.$inferSelect;

export const addressesTable = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  uniqueCode: text("unique_code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("residential"),
  gpsLat: text("gps_lat").notNull(),
  gpsLng: text("gps_lng").notNull(),
  fullAddress: text("full_address").notNull(),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  accessHours: text("access_hours"),
  notes: text("notes"),

  // --- DigiPIN (India Post national addressing grid) ---
  // Canonical 10-char code, no separators. Nullable + backfilled by a
  // migration script for existing rows; computed from gpsLat/gpsLng via
  // encodeDigipin() at write time going forward. Not unique: two addresses
  // (e.g. flats in one building) can legitimately share a ~4m grid cell.
  digipin: text("digipin"),

  // --- DigiLocker verification ---
  // Kept separate from contactPerson/contactNumber (rather than overwriting
  // them) so the app can show a "verified" badge while preserving whatever
  // was manually entered, and keep provenance if it's edited afterward.
  digilockerVerified: boolean("digilocker_verified").notNull().default(false),
  digilockerVerifiedName: text("digilocker_verified_name"),
  digilockerVerifiedMobile: text("digilocker_verified_mobile"),
  digilockerTxnId: text("digilocker_txn_id"),
  digilockerVerifiedAt: timestamp("digilocker_verified_at", { withTimezone: true }),
  // Full gateway payload (simulated today, real DigiLocker shape later) —
  // kept for audit even though only name/mobile are surfaced in the UI.
  digilockerRawResponse: json("digilocker_raw_response"),
  // One-way hash for "does this person already have another address on
  // file" — deliberately NOT the raw ID number. Storing Aadhaar numbers
  // directly requires UIDAI AUA/KUA authorization; a real DigiLocker
  // integration should provide its own stable reference/token to hash
  // instead. In this simulated flow it's derived from verified name+mobile,
  // which is enough to demonstrate the matching, but is not itself a real
  // identity credential.
  digilockerIdHash: text("digilocker_id_hash"),

  // --- Admin data verification ---
  // Distinct from digilockerVerified above: this is an admin confirming the
  // ADDRESS ENTRY itself is legitimate (right beat, not a duplicate, real
  // location) — not a check on who lives there. An address can be
  // DigiLocker-verified and still pending admin verification, or vice versa.
  verificationStatus: text("verification_status").notNull().default("pending"), // pending, verified, rejected
  verifiedBy: uuid("verified_by").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  // Single reference photo of the address itself (what the building/shop
  // looks like), separate from visitPhotosTable's per-visit evidence log.
  referencePhotoUrl: text("reference_photo_url"),

  beatId: uuid("beat_id").references(() => beatsTable.id, { onDelete: "set null" }),
  officeId: uuid("office_id").notNull().references(() => officesTable.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("addresses_digipin_idx").on(table.digipin),
  index("addresses_digilocker_id_hash_idx").on(table.digilockerIdHash),
]);

export const insertAddressSchema = createInsertSchema(addressesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // DigiLocker fields are only ever set by the verification flow below,
  // never through the general create/edit address form.
  digilockerVerified: true,
  digilockerVerifiedName: true,
  digilockerVerifiedMobile: true,
  digilockerTxnId: true,
  digilockerVerifiedAt: true,
  digilockerRawResponse: true,
  digilockerIdHash: true,
  // Same logic: admin verification and the reference photo are set by
  // their own dedicated actions, not the general create/edit form.
  verificationStatus: true,
  verifiedBy: true,
  verifiedAt: true,
  referencePhotoUrl: true,
});
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addressesTable.$inferSelect;

// Payload for the "Verify DigiLocker" action — separate from the general
// address insert/update path above.
export const digilockerVerificationSchema = z.object({
  addressId: z.string().uuid(),
  verifiedName: z.string().min(1),
  verifiedMobile: z.string().min(10).max(15),
  txnId: z.string().min(1),
  rawResponse: z.unknown().optional(),
});
export type DigilockerVerification = z.infer<typeof digilockerVerificationSchema>;
