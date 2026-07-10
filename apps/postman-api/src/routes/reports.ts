import { Router, type IRouter } from "express";
import { eq, and, gte, lt } from "drizzle-orm";
import { db, articlesTable, visitsTable, usersTable, userOfficesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function dateRange(from?: string, to?: string, period?: string): [Date, Date] {
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    return [start, end];
  }
  const start = new Date(end);
  if (period === "week") start.setDate(start.getDate() - 7);
  else if (period === "year") start.setFullYear(start.getFullYear() - 1);
  else start.setMonth(start.getMonth() - 1); // default month
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

router.get("/reports/daily", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { officeId, operatorId, date } = req.query as Record<string, string | undefined>;
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  const nextDay = new Date(d);
  nextDay.setDate(nextDay.getDate() + 1);

  let articles = await db.select().from(articlesTable);
  let visits = await db.select().from(visitsTable);

  if (officeId) {
    articles = articles.filter(a => a.officeId === officeId);
    visits = visits.filter(v => v.officeId === officeId);
  }
  if (operatorId) {
    articles = articles.filter(a => a.operatorId === operatorId);
    visits = visits.filter(v => v.operatorId === operatorId);
  }
  articles = articles.filter(a => a.issuedAt >= d && a.issuedAt < nextDay);
  visits = visits.filter(v => v.visitTimestamp >= d && v.visitTimestamp < nextDay);

  const visitsByType: Record<string, number> = {};
  for (const v of visits) {
    visitsByType[v.visitType] = (visitsByType[v.visitType] ?? 0) + 1;
  }
  const gpsRoute = visits
    .sort((a, b) => a.visitTimestamp.getTime() - b.visitTimestamp.getTime())
    .map(v => [v.gpsLat, v.gpsLng]);

  res.json({
    date: d.toISOString().split("T")[0],
    officeId: officeId ?? null,
    operatorId: operatorId ?? null,
    totalVisits: visits.length,
    totalArticles: articles.length,
    delivered: articles.filter(a => a.status === "delivered").length,
    attempted: articles.filter(a => a.status === "attempted").length,
    returned: articles.filter(a => a.status === "returned").length,
    visitsByType,
    gpsRoute,
  });
});

router.get("/reports/summary", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { officeId, period, from, to } = req.query as Record<string, string | undefined>;
  const [start, end] = dateRange(from, to, period);

  let articles = await db.select().from(articlesTable);
  let visits = await db.select().from(visitsTable);

  if (officeId) {
    articles = articles.filter(a => a.officeId === officeId);
    visits = visits.filter(v => v.officeId === officeId);
  }
  articles = articles.filter(a => a.issuedAt >= start && a.issuedAt <= end);
  visits = visits.filter(v => v.visitTimestamp >= start && v.visitTimestamp <= end);

  const delivered = articles.filter(a => a.status === "delivered").length;
  const deliveryRate = articles.length ? delivered / articles.length : 0;

  // Daily breakdown
  const days: Record<string, { delivered: number; visits: number }> = {};
  for (const a of articles) {
    const key = a.issuedAt.toISOString().split("T")[0];
    if (!days[key]) days[key] = { delivered: 0, visits: 0 };
    if (a.status === "delivered") days[key].delivered++;
  }
  for (const v of visits) {
    const key = v.visitTimestamp.toISOString().split("T")[0];
    if (!days[key]) days[key] = { delivered: 0, visits: 0 };
    days[key].visits++;
  }
  const dailyBreakdown = Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  res.json({
    period: period ?? "month",
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0],
    officeId: officeId ?? null,
    totalVisits: visits.length,
    totalArticles: articles.length,
    deliveryRate,
    topOperators: [],
    dailyBreakdown,
  });
});

router.get("/reports/operators", requireAuth, requireRole("office_admin", "super_admin"), async (req, res): Promise<void> => {
  const { officeId, from, to } = req.query as Record<string, string | undefined>;
  const [start, end] = dateRange(from, to);

  const opLinks = officeId
    ? await db.select({ userId: userOfficesTable.userId }).from(userOfficesTable).where(eq(userOfficesTable.officeId, officeId))
    : [];
  const opIds = opLinks.map(l => l.userId);
  const allOps = await db.select().from(usersTable).where(eq(usersTable.role, "field_operator"));
  const operators = officeId ? allOps.filter(o => opIds.includes(o.id)) : allOps;

  const result = await Promise.all(operators.map(async (op) => {
    const arts = await db.select().from(articlesTable).where(eq(articlesTable.operatorId, op.id));
    const visitsRows = await db.select().from(visitsTable).where(eq(visitsTable.operatorId, op.id));
    const periodArts = arts.filter(a => a.issuedAt >= start && a.issuedAt <= end);
    const periodVisits = visitsRows.filter(v => v.visitTimestamp >= start && v.visitTimestamp <= end);
    const delivered = periodArts.filter(a => a.status === "delivered").length;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    return {
      operatorId: op.id, operatorName: op.fullName,
      totalVisits: periodVisits.length,
      totalDeliveries: delivered,
      deliveryRate: periodArts.length ? delivered / periodArts.length : 0,
      avgDailyVisits: periodVisits.length / days,
    };
  }));
  res.json(result);
});

export default router;
