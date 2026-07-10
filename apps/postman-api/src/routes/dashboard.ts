import { Router, type IRouter } from "express";
import { eq, and, gte, lt, sql, desc } from "drizzle-orm";
import {
  db, usersTable, articlesTable, visitsTable,
  beatsTable, userOfficesTable, operatorLocationsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/admin", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { officeId } = req.query as { officeId?: string };
  const resolvedOfficeId = officeId ?? "";
  if (!resolvedOfficeId) {
    res.status(400).json({ error: "bad_request", message: "officeId required" });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const allArticles = await db.select().from(articlesTable).where(eq(articlesTable.officeId, resolvedOfficeId));
  const todayArticles = allArticles.filter(a => a.issuedAt >= today && a.issuedAt < tomorrow);

  const todayVisits = await db.select().from(visitsTable)
    .where(and(eq(visitsTable.officeId, resolvedOfficeId), gte(visitsTable.visitTimestamp, today), lt(visitsTable.visitTimestamp, tomorrow)));

  const beats = await db.select().from(beatsTable).where(eq(beatsTable.officeId, resolvedOfficeId));
  const opLinks = await db.select({ userId: userOfficesTable.userId }).from(userOfficesTable).where(eq(userOfficesTable.officeId, resolvedOfficeId));
  const opIds = opLinks.map(l => l.userId);

  // Get operators for this office that are field_operator role
  const allOperators = opIds.length
    ? await db.select().from(usersTable).where(eq(usersTable.role, "field_operator"))
    : [];
  const officeOperators = allOperators.filter(o => opIds.includes(o.id));

  // Live locations
  const liveLocations = await Promise.all(officeOperators.map(async op => {
    const [latest] = await db.select().from(operatorLocationsTable)
      .where(eq(operatorLocationsTable.operatorId, op.id))
      .orderBy(desc(operatorLocationsTable.recordedAt)).limit(1);
    return { operatorId: op.id, isOnline: latest ? latest.isOnline : false };
  }));
  const onlineSet = new Set(liveLocations.filter(l => l.isOnline).map(l => l.operatorId));

  const operatorSummaries = await Promise.all(officeOperators.map(async op => {
    const opArticles = allArticles.filter(a => a.operatorId === op.id);
    const opVisits = todayVisits.filter(v => v.operatorId === op.id);
    return {
      operatorId: op.id, operatorName: op.fullName,
      delivered: opArticles.filter(a => a.status === "delivered").length,
      pending: opArticles.filter(a => a.status === "pending").length,
      visits: opVisits.length,
      isOnline: onlineSet.has(op.id),
    };
  }));

  // 7-day trend
  const dailyTrend = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    }).map(async (d) => {
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);
      const dayArticles = allArticles.filter(a => a.issuedAt >= d && a.issuedAt < nextD);
      const dayVisits = await db.select().from(visitsTable)
        .where(and(eq(visitsTable.officeId, resolvedOfficeId), gte(visitsTable.visitTimestamp, d), lt(visitsTable.visitTimestamp, nextD)));
      return {
        date: d.toISOString().split("T")[0],
        delivered: dayArticles.filter(a => a.status === "delivered").length,
        visits: dayVisits.length,
      };
    })
  );

  const [office] = await db.select().from(usersTable).limit(0); // just to avoid import issue
  res.json({
    officeId: resolvedOfficeId,
    officeName: resolvedOfficeId,
    date: today.toISOString().split("T")[0],
    totalOperators: officeOperators.length,
    activeOperators: onlineSet.size,
    totalArticles: todayArticles.length,
    deliveredArticles: todayArticles.filter(a => a.status === "delivered").length,
    pendingArticles: todayArticles.filter(a => a.status === "pending").length,
    attemptedArticles: todayArticles.filter(a => a.status === "attempted").length,
    returnedArticles: todayArticles.filter(a => a.status === "returned").length,
    totalVisits: todayVisits.length,
    totalBeats: beats.length,
    dailyTrend,
    operatorSummaries,
  });
});

router.get("/dashboard/operator", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const articles = await db.select().from(articlesTable).where(eq(articlesTable.operatorId, user.userId));
  const todayArticles = articles.filter(a => a.issuedAt >= today && a.issuedAt < tomorrow);
  const todayVisits = await db.select().from(visitsTable)
    .where(and(eq(visitsTable.operatorId, user.userId), gte(visitsTable.visitTimestamp, today), lt(visitsTable.visitTimestamp, tomorrow)));

  const [beat] = await db.select().from(beatsTable).where(eq(beatsTable.operatorId, user.userId));

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));

  res.json({
    operatorId: user.userId,
    operatorName: dbUser?.fullName ?? user.username,
    date: today.toISOString().split("T")[0],
    pendingArticles: todayArticles.filter(a => a.status === "pending").length,
    deliveredToday: todayArticles.filter(a => a.status === "delivered").length,
    visitsToday: todayVisits.length,
    pendingSync: 0,
    beatId: beat?.id ?? null,
    beatName: beat?.name ?? null,
    articles: articles.filter(a => a.status === "pending").map(a => ({
      id: a.id, barcode: a.barcode, articleNumber: a.articleNumber,
      addressee: a.addressee, deliveryAddress: a.deliveryAddress,
      phone: a.phone ?? null, status: a.status,
      deliveryReason: a.deliveryReason ?? null,
      operatorId: a.operatorId ?? null, officeId: a.officeId,
      gpsLat: a.gpsLat ?? null, gpsLng: a.gpsLng ?? null,
      deliveredAt: a.deliveredAt?.toISOString() ?? null,
      issuedAt: a.issuedAt.toISOString(),
      requiresSignature: a.requiresSignature,
      requiresPhoto: a.requiresPhoto,
      isCod: a.isCod, codAmount: a.codAmount ?? null,
    })),
  });
});

export default router;
