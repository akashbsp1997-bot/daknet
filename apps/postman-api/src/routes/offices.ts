import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, officesTable, userOfficesTable, beatsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/offices", requireAuth, async (req, res): Promise<void> => {
  const isActive = req.query.isActive;
  let query = db.select().from(officesTable);
  if (isActive !== undefined) {
    const active = isActive === "true";
    // @ts-ignore
    query = db.select().from(officesTable).where(eq(officesTable.isActive, active));
  }
  const offices = await query;
  const result = await Promise.all(
    offices.map(async (o) => {
      const [beatCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(beatsTable)
        .where(eq(beatsTable.officeId, o.id));
      const [opCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userOfficesTable)
        .where(eq(userOfficesTable.officeId, o.id));
      return {
        id: o.id, name: o.name, code: o.code, address: o.address,
        district: o.district, state: o.state, pincode: o.pincode,
        phone: o.phone ?? null, polygonGeoJson: o.polygonGeoJson ?? null,
        isActive: o.isActive,
        beatCount: beatCount?.count ?? 0,
        operatorCount: opCount?.count ?? 0,
        createdAt: o.createdAt.toISOString(),
      };
    })
  );
  res.json(result);
});

router.post("/offices", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const { name, code, address, district, state, pincode, phone, polygonGeoJson } = req.body;
  if (!name || !code || !address || !district || !state || !pincode) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }
  const [office] = await db.insert(officesTable).values({
    name, code, address, district, state, pincode,
    phone: phone ?? null,
    polygonGeoJson: polygonGeoJson ?? null,
  }).returning();
  res.status(201).json({
    id: office.id, name: office.name, code: office.code, address: office.address,
    district: office.district, state: office.state, pincode: office.pincode,
    phone: office.phone ?? null, polygonGeoJson: office.polygonGeoJson ?? null,
    isActive: office.isActive, beatCount: 0, operatorCount: 0,
    createdAt: office.createdAt.toISOString(),
  });
});

router.get("/offices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [office] = await db.select().from(officesTable).where(eq(officesTable.id, id));
  if (!office) { res.status(404).json({ error: "not_found", message: "Office not found" }); return; }
  const [beatCount] = await db.select({ count: sql<number>`count(*)::int` }).from(beatsTable).where(eq(beatsTable.officeId, id));
  const [opCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userOfficesTable).where(eq(userOfficesTable.officeId, id));
  res.json({
    id: office.id, name: office.name, code: office.code, address: office.address,
    district: office.district, state: office.state, pincode: office.pincode,
    phone: office.phone ?? null, polygonGeoJson: office.polygonGeoJson ?? null,
    isActive: office.isActive, beatCount: beatCount?.count ?? 0, operatorCount: opCount?.count ?? 0,
    createdAt: office.createdAt.toISOString(),
  });
});

router.put("/offices/:id", requireAuth, requireRole("super_admin", "office_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, address, district, state, pincode, phone, polygonGeoJson } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (district !== undefined) updates.district = district;
  if (state !== undefined) updates.state = state;
  if (pincode !== undefined) updates.pincode = pincode;
  if (phone !== undefined) updates.phone = phone;
  if (polygonGeoJson !== undefined) updates.polygonGeoJson = polygonGeoJson;
  const [office] = await db.update(officesTable).set(updates).where(eq(officesTable.id, id)).returning();
  if (!office) { res.status(404).json({ error: "not_found", message: "Office not found" }); return; }
  const [beatCount] = await db.select({ count: sql<number>`count(*)::int` }).from(beatsTable).where(eq(beatsTable.officeId, id));
  const [opCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userOfficesTable).where(eq(userOfficesTable.officeId, id));
  res.json({
    id: office.id, name: office.name, code: office.code, address: office.address,
    district: office.district, state: office.state, pincode: office.pincode,
    phone: office.phone ?? null, polygonGeoJson: office.polygonGeoJson ?? null,
    isActive: office.isActive, beatCount: beatCount?.count ?? 0, operatorCount: opCount?.count ?? 0,
    createdAt: office.createdAt.toISOString(),
  });
});

router.patch("/offices/:id/status", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isActive } = req.body as { isActive?: boolean };
  if (isActive === undefined) { res.status(400).json({ error: "bad_request", message: "isActive required" }); return; }
  const [office] = await db.update(officesTable).set({ isActive }).where(eq(officesTable.id, id)).returning();
  if (!office) { res.status(404).json({ error: "not_found", message: "Office not found" }); return; }
  res.json({ id: office.id, name: office.name, code: office.code, address: office.address,
    district: office.district, state: office.state, pincode: office.pincode,
    phone: office.phone ?? null, polygonGeoJson: office.polygonGeoJson ?? null,
    isActive: office.isActive, beatCount: 0, operatorCount: 0, createdAt: office.createdAt.toISOString() });
});

export default router;
