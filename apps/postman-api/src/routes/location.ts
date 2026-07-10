import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, operatorLocationsTable, usersTable, userOfficesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/location", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { gpsLat, gpsLng, batteryLevel, isOnline } = req.body;
  if (gpsLat === undefined || gpsLng === undefined) {
    res.status(400).json({ error: "bad_request", message: "gpsLat and gpsLng required" });
    return;
  }
  await db.insert(operatorLocationsTable).values({
    operatorId: user.userId,
    gpsLat: Number(gpsLat), gpsLng: Number(gpsLng),
    batteryLevel: batteryLevel ?? null,
    isOnline: isOnline ?? true,
  });
  res.json({ success: true });
});

router.get("/location/operators", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { officeId } = req.query as { officeId?: string };

  // Get all field operators
  let operators = await db.select().from(usersTable).where(eq(usersTable.role, "field_operator"));
  if (officeId) {
    const links = await db.select({ userId: userOfficesTable.userId })
      .from(userOfficesTable).where(eq(userOfficesTable.officeId, officeId));
    const ids = new Set(links.map(l => l.userId));
    operators = operators.filter(o => ids.has(o.id));
  }

  const result = await Promise.all(operators.map(async (op) => {
    const [latest] = await db.select().from(operatorLocationsTable)
      .where(eq(operatorLocationsTable.operatorId, op.id))
      .orderBy(desc(operatorLocationsTable.recordedAt)).limit(1);
    if (!latest) return null;
    return {
      operatorId: op.id, operatorName: op.fullName,
      gpsLat: latest.gpsLat, gpsLng: latest.gpsLng,
      batteryLevel: latest.batteryLevel ?? null,
      isOnline: latest.isOnline,
      lastSeen: latest.recordedAt.toISOString(),
    };
  }));
  res.json(result.filter(Boolean));
});

export default router;
