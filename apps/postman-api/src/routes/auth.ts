import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, userOfficesTable, refreshTokensTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  hashToken,
  REFRESH_TOKEN_EXPIRY_DATE,
} from "../lib/jwt";

const router: IRouter = Router();

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

async function ensureSuperAdmin() {
  if (!SUPER_ADMIN_USERNAME || !SUPER_ADMIN_PASSWORD) return;
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, SUPER_ADMIN_USERNAME));
  if (!existing) {
    const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
    await db.insert(usersTable).values({
      username: SUPER_ADMIN_USERNAME,
      passwordHash: hash,
      fullName: "Super Administrator",
      role: "super_admin",
      isActive: true,
    });
  }
}
ensureSuperAdmin().catch(() => {});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "bad_request", message: "Username and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }

  // Get office IDs for this user
  const officeLinks = await db
    .select({ officeId: userOfficesTable.officeId })
    .from(userOfficesTable)
    .where(eq(userOfficesTable.userId, user.id));

  const accessToken = signAccessToken({ userId: user.id, role: user.role, username: user.username });
  const refreshToken = signRefreshToken();
  const tokenHash = hashToken(refreshToken);
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt: REFRESH_TOKEN_EXPIRY_DATE(),
  });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone ?? null,
      employeeId: user.employeeId ?? null,
      isActive: user.isActive,
      officeIds: officeLinks.map((l) => l.officeId),
      beatId: null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: "bad_request", message: "Refresh token required" });
    return;
  }
  const tokenHash = hashToken(refreshToken);
  const now = new Date();
  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(and(eq(refreshTokensTable.tokenHash, tokenHash), gt(refreshTokensTable.expiresAt, now)));
  if (!stored) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired refresh token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, stored.userId));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "unauthorized", message: "User not found or inactive" });
    return;
  }
  const officeLinks = await db
    .select({ officeId: userOfficesTable.officeId })
    .from(userOfficesTable)
    .where(eq(userOfficesTable.userId, user.id));

  const newAccessToken = signAccessToken({ userId: user.id, role: user.role, username: user.username });
  const newRefreshToken = signRefreshToken();
  const newHash = hashToken(newRefreshToken);
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.tokenHash, tokenHash));
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: newHash,
    expiresAt: REFRESH_TOKEN_EXPIRY_DATE(),
  });
  res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone ?? null,
      employeeId: user.employeeId ?? null,
      isActive: user.isActive,
      officeIds: officeLinks.map((l) => l.officeId),
      beatId: null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, userId));
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }
  const officeLinks = await db
    .select({ officeId: userOfficesTable.officeId })
    .from(userOfficesTable)
    .where(eq(userOfficesTable.userId, user.id));

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone ?? null,
    employeeId: user.employeeId ?? null,
    isActive: user.isActive,
    officeIds: officeLinks.map((l) => l.officeId),
    beatId: null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
