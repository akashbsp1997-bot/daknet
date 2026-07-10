import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, beatsTable, addressesTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function formatBeat(b: typeof beatsTable.$inferSelect) {
  const [addrCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressesTable)
    .where(eq(addressesTable.beatId, b.id));
  let operatorName: string | null = null;
  if (b.operatorId) {
    const [op] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, b.operatorId));
    operatorName = op?.fullName ?? null;
  }
  return {
    id: b.id, name: b.name, officeId: b.officeId,
    operatorId: b.operatorId ?? null, operatorName,
    polygonGeoJson: b.polygonGeoJson ?? null,
    addressCount: addrCount?.count ?? 0,
    isActive: b.isActive, createdAt: b.createdAt.toISOString(),
  };
}

router.get("/beats", requireAuth, async (req, res): Promise<void> => {
  const { officeId } = req.query as { officeId?: string };
  let beats = await db.select().from(beatsTable);
  if (officeId) beats = beats.filter(b => b.officeId === officeId);
  const result = await Promise.all(beats.map(formatBeat));
  res.json(result);
});

router.post("/beats", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { name, officeId, polygonGeoJson, operatorId } = req.body;
  if (!name || !officeId) {
    res.status(400).json({ error: "bad_request", message: "name and officeId required" });
    return;
  }
  const [beat] = await db.insert(beatsTable).values({
    name, officeId, polygonGeoJson: polygonGeoJson ?? null,
    operatorId: operatorId ?? null,
  }).returning();
  res.status(201).json(await formatBeat(beat));
});

router.get("/beats/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [beat] = await db.select().from(beatsTable).where(eq(beatsTable.id, id));
  if (!beat) { res.status(404).json({ error: "not_found", message: "Beat not found" }); return; }
  res.json(await formatBeat(beat));
});

router.put("/beats/:id", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, polygonGeoJson, operatorId } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (polygonGeoJson !== undefined) updates.polygonGeoJson = polygonGeoJson;
  if (operatorId !== undefined) updates.operatorId = operatorId;
  const [beat] = await db.update(beatsTable).set(updates).where(eq(beatsTable.id, id)).returning();
  if (!beat) { res.status(404).json({ error: "not_found", message: "Beat not found" }); return; }
  res.json(await formatBeat(beat));
});

router.post("/beats/:id/assign", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { operatorId } = req.body as { operatorId?: string };
  if (!operatorId) { res.status(400).json({ error: "bad_request", message: "operatorId required" }); return; }
  const [beat] = await db.update(beatsTable).set({ operatorId }).where(eq(beatsTable.id, id)).returning();
  if (!beat) { res.status(404).json({ error: "not_found", message: "Beat not found" }); return; }
  res.json(await formatBeat(beat));
});

export default router;
