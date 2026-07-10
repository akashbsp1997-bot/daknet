import { Router, type IRouter } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, visitsTable, userOfficesTable, visitPhotosTable, addressesTable, encodeDigipin } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { uploadPhoto, getPhotoUrl } from "../lib/storage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function formatVisit(v: typeof visitsTable.$inferSelect) {
  return {
    id: v.id, operatorId: v.operatorId, officeId: v.officeId,
    beatId: v.beatId ?? null, addressId: v.addressId ?? null,
    visitType: v.visitType, gpsLat: v.gpsLat, gpsLng: v.gpsLng,
    timestamp: v.visitTimestamp.toISOString(),
    notes: v.notes ?? null, contactNumber: v.contactNumber ?? null,
    verificationMethod: v.verificationMethod ?? null,
    verifiedRecipientName: v.verifiedRecipientName ?? null,
    verifiedRecipientMobile: v.verifiedRecipientMobile ?? null,
    verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
    isSynced: v.isSynced, createdAt: v.createdAt.toISOString(),
  };
}

router.get("/visits", requireAuth, async (req, res): Promise<void> => {
  const { operatorId, officeId, date, isSynced } = req.query as Record<string, string | undefined>;
  let visits = await db.select().from(visitsTable);
  if (operatorId) visits = visits.filter(v => v.operatorId === operatorId);
  if (officeId) visits = visits.filter(v => v.officeId === officeId);
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    visits = visits.filter(v => v.visitTimestamp >= d && v.visitTimestamp < nextDay);
  }
  if (isSynced !== undefined) visits = visits.filter(v => v.isSynced === (isSynced === "true"));
  res.json(visits.map(formatVisit));
});

router.post("/visits", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { beatId, addressId, visitType, gpsLat, gpsLng, timestamp, notes, contactNumber } = req.body;
  if (!visitType || gpsLat === undefined || gpsLng === undefined || !timestamp) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }
  const officeLinks = await db
    .select({ officeId: userOfficesTable.officeId })
    .from(userOfficesTable)
    .where(eq(userOfficesTable.userId, user.userId));
  const officeId = officeLinks[0]?.officeId;
  if (!officeId) {
    res.status(400).json({ error: "bad_request", message: "Operator has no assigned office" });
    return;
  }
  const [visit] = await db.insert(visitsTable).values({
    operatorId: user.userId, officeId,
    beatId: beatId ?? null, addressId: addressId ?? null,
    visitType, gpsLat: Number(gpsLat), gpsLng: Number(gpsLng),
    visitTimestamp: new Date(timestamp),
    notes: notes ?? null, contactNumber: contactNumber ?? null,
    isSynced: true,
  }).returning();
  res.status(201).json(formatVisit(visit));
});

router.put("/visits/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { notes, isSynced } = req.body;
  const updates: Record<string, unknown> = {};
  if (notes !== undefined) updates.notes = notes;
  if (isSynced !== undefined) updates.isSynced = isSynced;
  const [visit] = await db.update(visitsTable).set(updates).where(eq(visitsTable.id, id)).returning();
  if (!visit) { res.status(404).json({ error: "not_found", message: "Visit not found" }); return; }
  res.json(formatVisit(visit));
});

// --- Photo evidence ---
router.post("/visits/:id/photos", requireAuth, upload.single("photo"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { gpsLat, gpsLng, capturedAt } = req.body;

  if (!req.file) {
    res.status(400).json({ error: "bad_request", message: "photo file is required" });
    return;
  }
  if (!capturedAt) {
    res.status(400).json({ error: "bad_request", message: "capturedAt is required" });
    return;
  }

  const [visit] = await db.select().from(visitsTable).where(eq(visitsTable.id, id));
  if (!visit) { res.status(404).json({ error: "not_found", message: "Visit not found" }); return; }

  const lat = gpsLat !== undefined ? Number(gpsLat) : null;
  const lng = gpsLng !== undefined ? Number(gpsLng) : null;
  // Unlike address creation, a bad capture-time GPS reading doesn't block
  // the photo itself — it's secondary metadata, not the point of the call.
  let digipin: string | null = null;
  if (lat !== null && lng !== null) {
    try { digipin = encodeDigipin(lat, lng); } catch { digipin = null; }
  }

  const key = await uploadPhoto(req.file.buffer, req.file.mimetype, "visits");

  const [photo] = await db.insert(visitPhotosTable).values({
    visitId: id,
    photoUrl: key,
    gpsLat: lat,
    gpsLng: lng,
    digipin,
    capturedAt: new Date(capturedAt),
    isSynced: true,
  }).returning();

  const signedUrl = await getPhotoUrl(photo.photoUrl);

  res.status(201).json({
    id: photo.id, visitId: photo.visitId, photoUrl: signedUrl,
    gpsLat: photo.gpsLat ?? null, gpsLng: photo.gpsLng ?? null, digipin: photo.digipin ?? null,
    capturedAt: photo.capturedAt.toISOString(), isSynced: photo.isSynced,
    createdAt: photo.createdAt.toISOString(),
  });
});

// --- Delivery signature (SIMULATED — govt-service-backed, replaces wet-ink signature) ---
router.post("/visits/:id/sign-delivery", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { method } = req.body as { method?: string };
  if (method !== "digilocker" && method !== "aadhaar_esign") {
    res.status(400).json({ error: "bad_request", message: "method must be 'digilocker' or 'aadhaar_esign'" });
    return;
  }

  const [visit] = await db.select().from(visitsTable).where(eq(visitsTable.id, id));
  if (!visit) { res.status(404).json({ error: "not_found", message: "Visit not found" }); return; }

  // As with verify-digilocker on addresses: echoes real data where it's
  // already on file (the linked address's registered occupant, if any),
  // falls back to an obviously-fake placeholder otherwise.
  let verifiedName = "Simulated Recipient";
  let verifiedMobile = visit.contactNumber || "9999999999";
  if (visit.addressId) {
    const [address] = await db.select().from(addressesTable).where(eq(addressesTable.id, visit.addressId));
    if (address?.contactPerson) verifiedName = address.contactPerson;
    if (address?.contactNumber) verifiedMobile = address.contactNumber;
  }

  const txnId = `SIM-${method.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const rawResponse = {
    simulated: true,
    gateway: method,
    txnId,
    name: verifiedName,
    mobile: verifiedMobile,
    verifiedAt: new Date().toISOString(),
  };

  const [updated] = await db.update(visitsTable).set({
    verificationMethod: method,
    verifiedRecipientName: verifiedName,
    verifiedRecipientMobile: verifiedMobile,
    verificationTxnId: txnId,
    verifiedAt: new Date(),
    verificationRawResponse: rawResponse,
  }).where(eq(visitsTable.id, id)).returning();

  res.json(formatVisit(updated));
});

export default router;
