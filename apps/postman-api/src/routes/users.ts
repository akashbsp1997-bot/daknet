import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, userOfficesTable, beatsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function formatUser(u: typeof usersTable.$inferSelect, officeIds: string[], beatId: string | null) {
  return {
    id: u.id, username: u.username, fullName: u.fullName, role: u.role,
    phone: u.phone ?? null, employeeId: u.employeeId ?? null,
    isActive: u.isActive, officeIds, beatId, createdAt: u.createdAt.toISOString(),
  };
}

async function getUserWithDetails(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const officeLinks = await db.select({ officeId: userOfficesTable.officeId })
    .from(userOfficesTable).where(eq(userOfficesTable.userId, userId));
  const [beat] = await db.select({ id: beatsTable.id }).from(beatsTable)
    .where(eq(beatsTable.operatorId, userId));
  return formatUser(user, officeLinks.map(l => l.officeId), beat?.id ?? null);
}

router.get("/users", requireAuth, requireRole("super_admin", "office_admin"), async (req, res): Promise<void> => {
  const { role, officeId } = req.query as { role?: string; officeId?: string };
  let users = await db.select().from(usersTable);
  if (role) users = users.filter(u => u.role === role);
  const result = await Promise.all(
    users.map(async (u) => {
      const officeLinks = await db.select({ officeId: userOfficesTable.officeId })
        .from(userOfficesTable).where(eq(userOfficesTable.userId, u.id));
      if (officeId && !officeLinks.some(l => l.officeId === officeId)) return null;
      const [beat] = await db.select({ id: beatsTable.id }).from(beatsTable).where(eq(beatsTable.operatorId, u.id));
      return formatUser(u, officeLinks.map(l => l.officeId), beat?.id ?? null);
    })
  );
  res.json(result.filter(Boolean));
});

router.post("/users", requireAuth, requireRole("super_admin", "office_admin"), async (req, res): Promise<void> => {
  const { username, password, fullName, role, phone, employeeId, officeIds } = req.body;
  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    username, passwordHash: hash, fullName, role,
    phone: phone ?? null, employeeId: employeeId ?? null,
  }).returning();
  if (officeIds?.length) {
    await db.insert(userOfficesTable).values(
      (officeIds as string[]).map(oid => ({ userId: user.id, officeId: oid }))
    );
  }
  const details = await getUserWithDetails(user.id);
  res.status(201).json(details);
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const details = await getUserWithDetails(id);
  if (!details) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
  res.json(details);
});

router.put("/users/:id", requireAuth, requireRole("super_admin", "office_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { fullName, phone, employeeId, password, officeIds } = req.body;
  const updates: Record<string, unknown> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (employeeId !== undefined) updates.employeeId = employeeId;
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);
  if (Object.keys(updates).length) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  }
  if (officeIds !== undefined) {
    await db.delete(userOfficesTable).where(eq(userOfficesTable.userId, id));
    if ((officeIds as string[]).length) {
      await db.insert(userOfficesTable).values(
        (officeIds as string[]).map(oid => ({ userId: id, officeId: oid }))
      );
    }
  }
  const details = await getUserWithDetails(id);
  if (!details) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
  res.json(details);
});

router.post("/users/:id/offices", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { officeIds } = req.body as { officeIds?: string[] };
  if (!officeIds) { res.status(400).json({ error: "bad_request", message: "officeIds required" }); return; }
  await db.delete(userOfficesTable).where(eq(userOfficesTable.userId, id));
  if (officeIds.length) {
    await db.insert(userOfficesTable).values(officeIds.map(oid => ({ userId: id, officeId: oid })));
  }
  const details = await getUserWithDetails(id);
  if (!details) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
  res.json(details);
});

router.patch("/users/:id/status", requireAuth, requireRole("super_admin", "office_admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isActive } = req.body as { isActive?: boolean };
  if (isActive === undefined) { res.status(400).json({ error: "bad_request", message: "isActive required" }); return; }
  const [user] = await db.update(usersTable).set({ isActive }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
  const details = await getUserWithDetails(id);
  res.json(details);
});

export default router;
