import { Router, type IRouter } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { eq, and, or, ilike, gt, asc } from "drizzle-orm";
import { db, addressesTable, encodeDigipin, DigipinError } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { uploadPhoto } from "../lib/storage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

function formatAddress(a: typeof addressesTable.$inferSelect) {
  return {
    id: a.id, uniqueCode: a.uniqueCode, name: a.name, type: a.type,
    gpsLat: Number(a.gpsLat), gpsLng: Number(a.gpsLng),
    fullAddress: a.fullAddress, contactPerson: a.contactPerson ?? null,
    contactNumber: a.contactNumber ?? null, accessHours: a.accessHours ?? null,
    notes: a.notes ?? null,
    digipin: a.digipin ?? null,
    digilockerVerified: a.digilockerVerified,
    digilockerVerifiedName: a.digilockerVerifiedName ?? null,
    digilockerVerifiedMobile: a.digilockerVerifiedMobile ?? null,
    digilockerVerifiedAt: a.digilockerVerifiedAt ? a.digilockerVerifiedAt.toISOString() : null,
    verificationStatus: a.verificationStatus,
    verifiedBy: a.verifiedBy ?? null,
    verifiedAt: a.verifiedAt ? a.verifiedAt.toISOString() : null,
    referencePhotoUrl: a.referencePhotoUrl ?? null,
    beatId: a.beatId ?? null, officeId: a.officeId,
    createdBy: a.createdBy, createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// One-way fingerprint for "does this person already have another address on
// file" — see the schema comment on digilockerIdHash for why this isn't a
// raw ID number. Normalizes so trivial formatting differences still match.
function computeIdentityHash(name: string, mobile: string): string {
  const normalized = `${name.trim().toLowerCase()}|${mobile.trim()}`;
  return createHash("sha256").update(normalized).digest("hex");
}

// Alphabetical, server-side search, keyset-paginated — NOT "load every
// address into memory and filter in JS". That works at Rourkela-Division
// scale; it does not work at "the whole country's addresses" scale, which
// is the explicit target here. Keyset (not OFFSET) pagination so page 500
// is exactly as fast as page 1 — OFFSET pagination gets slower the deeper
// you page, because Postgres still has to walk past every skipped row.
router.get("/addresses", requireAuth, async (req, res): Promise<void> => {
  const { beatId, officeId, q, type, cursor, limit: limitParam } = req.query as Record<string, string | undefined>;
  const limit = Math.min(Math.max(Number(limitParam) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const conditions = [];
  if (beatId) conditions.push(eq(addressesTable.beatId, beatId));
  if (officeId) conditions.push(eq(addressesTable.officeId, officeId));
  if (type) conditions.push(eq(addressesTable.type, type));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(or(
      ilike(addressesTable.name, pattern),
      ilike(addressesTable.fullAddress, pattern),
      ilike(addressesTable.uniqueCode, pattern),
      ilike(addressesTable.digipin, pattern),
    ));
  }
  if (cursor) {
    const sepIndex = cursor.lastIndexOf("|");
    const cursorName = cursor.slice(0, sepIndex);
    const cursorId = cursor.slice(sepIndex + 1);
    conditions.push(or(
      gt(addressesTable.name, cursorName),
      and(eq(addressesTable.name, cursorName), gt(addressesTable.id, cursorId)),
    ));
  }

  const rows = await db.select().from(addressesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(addressesTable.name), asc(addressesTable.id))
    .limit(limit + 1); // fetch one extra to know whether there's a next page

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? `${last.name}|${last.id}` : null;

  res.json({ items: page.map(formatAddress), nextCursor });
});

router.post("/addresses", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { name, type, gpsLat, gpsLng, fullAddress, contactPerson, contactNumber, accessHours, notes, beatId, officeId } = req.body;
  if (!name || !type || gpsLat === undefined || gpsLng === undefined || !fullAddress || !officeId) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }

  let digipin: string;
  try {
    digipin = encodeDigipin(Number(gpsLat), Number(gpsLng));
  } catch (err) {
    if (err instanceof DigipinError) {
      res.status(400).json({ error: "bad_request", message: err.message });
      return;
    }
    throw err;
  }

  const uniqueCode = `ADDR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [address] = await db.insert(addressesTable).values({
    uniqueCode, name, type, gpsLat: String(gpsLat), gpsLng: String(gpsLng),
    digipin,
    fullAddress, contactPerson: contactPerson ?? null,
    contactNumber: contactNumber ?? null, accessHours: accessHours ?? null,
    notes: notes ?? null, beatId: beatId ?? null, officeId,
    createdBy: user.userId,
  }).returning();
  res.status(201).json(formatAddress(address));
});

router.put("/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, type, gpsLat, gpsLng, fullAddress, contactPerson, contactNumber, accessHours, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (gpsLat !== undefined) updates.gpsLat = String(gpsLat);
  if (gpsLng !== undefined) updates.gpsLng = String(gpsLng);
  if (gpsLat !== undefined && gpsLng !== undefined) {
    try {
      updates.digipin = encodeDigipin(Number(gpsLat), Number(gpsLng));
    } catch (err) {
      if (err instanceof DigipinError) {
        res.status(400).json({ error: "bad_request", message: err.message });
        return;
      }
      throw err;
    }
  }
  if (fullAddress !== undefined) updates.fullAddress = fullAddress;
  if (contactPerson !== undefined) updates.contactPerson = contactPerson;
  if (contactNumber !== undefined) updates.contactNumber = contactNumber;
  if (accessHours !== undefined) updates.accessHours = accessHours;
  if (notes !== undefined) updates.notes = notes;
  const [address] = await db.update(addressesTable).set(updates).where(eq(addressesTable.id, id)).returning();
  if (!address) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }
  res.json(formatAddress(address));
});

router.get("/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [address] = await db.select().from(addressesTable).where(eq(addressesTable.id, id));
  if (!address) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }
  res.json(formatAddress(address));
});

// --- Possible duplicates: same person (by identity hash), different address ---
router.get("/addresses/:id/possible-duplicates", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, id));
  if (!existing) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }
  if (!existing.digilockerIdHash) {
    res.json([]); // nothing to match against until this address is DigiLocker-verified
    return;
  }
  const matches = await db.select().from(addressesTable)
    .where(and(
      eq(addressesTable.digilockerIdHash, existing.digilockerIdHash),
      // exclude itself
    ));
  res.json(matches.filter(m => m.id !== id).map(formatAddress));
});

// --- DigiLocker identity verification (SIMULATED — no real partner integration yet) ---
router.post("/addresses/:id/verify-digilocker", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, id));
  if (!existing) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }

  const verifiedName = existing.contactPerson || "Simulated Resident";
  const verifiedMobile = existing.contactNumber || "9999999999";
  const txnId = `SIM-DL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const idHash = computeIdentityHash(verifiedName, verifiedMobile);
  const rawResponse = {
    simulated: true,
    gateway: "digilocker",
    txnId,
    name: verifiedName,
    mobile: verifiedMobile,
    verifiedAt: new Date().toISOString(),
  };

  const [address] = await db.update(addressesTable).set({
    digilockerVerified: true,
    digilockerVerifiedName: verifiedName,
    digilockerVerifiedMobile: verifiedMobile,
    digilockerTxnId: txnId,
    digilockerVerifiedAt: new Date(),
    digilockerRawResponse: rawResponse,
    digilockerIdHash: idHash,
  }).where(eq(addressesTable.id, id)).returning();

  res.json(formatAddress(address));
});

// --- Admin data verification (the address entry itself, not the resident's identity) ---
router.post("/addresses/:id/verify", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status?: string };
  if (status !== "verified" && status !== "rejected") {
    res.status(400).json({ error: "bad_request", message: "status must be 'verified' or 'rejected'" });
    return;
  }
  const user = req.user!;
  const [address] = await db.update(addressesTable).set({
    verificationStatus: status,
    verifiedBy: user.userId,
    verifiedAt: new Date(),
  }).where(eq(addressesTable.id, id)).returning();
  if (!address) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }
  res.json(formatAddress(address));
});

// --- Reference photo (what the address itself looks like) ---
router.post("/addresses/:id/photo", requireAuth, upload.single("photo"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!req.file) {
    res.status(400).json({ error: "bad_request", message: "photo file is required" });
    return;
  }
  const [existing] = await db.select().from(addressesTable).where(eq(addressesTable.id, id));
  if (!existing) { res.status(404).json({ error: "not_found", message: "Address not found" }); return; }

  const key = await uploadPhoto(req.file.buffer, req.file.mimetype, "addresses");
  const [address] = await db.update(addressesTable)
    .set({ referencePhotoUrl: key })
    .where(eq(addressesTable.id, id))
    .returning();
  res.json(formatAddress(address));
});

export default router;
