import { sql } from "drizzle-orm";
import { db } from "../index";
import { beatsTable } from "../schema/beats";

/**
 * Finds the beat whose polygon contains a given point.
 *
 * This is what `geom` (PostGIS geometry) buys you over `polygonGeoJson`
 * (plain json): Postgres can't index into a json blob to answer "which
 * polygon contains this point?" without scanning and parsing every row in
 * application code. With a real geometry column + GiST index, the database
 * answers it directly — ST_Contains is a single indexed spatial lookup.
 *
 * Requires: the postgis extension enabled, and beats.geom backfilled from
 * polygonGeoJson (both are one-time setup steps, not something drizzle-kit
 * push handles — see the PostGIS setup notes).
 */
export async function findBeatContainingPoint(lat: number, lng: number) {
  // ST_MakePoint takes (x, y) = (longitude, latitude) — easy to get backwards,
  // Postgres won't error if you do, it'll just silently look in the wrong
  // hemisphere. SRID 4326 has to match the column's SRID or ST_Contains
  // throws rather than silently doing the wrong thing.
  const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

  const [beat] = await db
    .select()
    .from(beatsTable)
    .where(sql`${beatsTable.geom} IS NOT NULL AND ST_Contains(${beatsTable.geom}, ${point})`)
    .limit(1);

  return beat ?? null;
}

// Try writing findOfficeContainingPoint(lat, lng) yourself — same shape,
// swap beatsTable for officesTable. It's the same pattern; writing it once
// without copying is the actual point of doing this hands-on.
