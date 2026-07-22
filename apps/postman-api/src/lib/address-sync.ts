import { eq } from "drizzle-orm";
import { db, addressesTable, encodeDigipin, DigipinError } from "@workspace/db";

/**
 * A field visit is a more trustworthy GPS reading than however the address
 * was originally entered — refresh the linked address's location from it.
 * Best-effort: an out-of-range reading just skips the refresh rather than
 * failing the visit that triggered it.
 */
export async function refreshAddressLocation(addressId: string, lat: number, lng: number): Promise<void> {
  let digipin: string;
  try {
    digipin = encodeDigipin(lat, lng);
  } catch (err) {
    if (err instanceof DigipinError) return;
    throw err;
  }
  await db.update(addressesTable)
    .set({ gpsLat: String(lat), gpsLng: String(lng), digipin })
    .where(eq(addressesTable.id, addressId));
}
