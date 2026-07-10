import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, articlesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatArticle(a: typeof articlesTable.$inferSelect) {
  return {
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
  };
}

router.get("/articles", requireAuth, async (req, res): Promise<void> => {
  const { officeId, operatorId, status, date } = req.query as Record<string, string | undefined>;
  let articles = await db.select().from(articlesTable);
  if (officeId) articles = articles.filter(a => a.officeId === officeId);
  if (operatorId) articles = articles.filter(a => a.operatorId === operatorId);
  if (status) articles = articles.filter(a => a.status === status);
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    articles = articles.filter(a => a.issuedAt >= d && a.issuedAt < nextDay);
  }
  res.json(articles.map(formatArticle));
});

router.post("/articles", requireAuth, async (req, res): Promise<void> => {
  const { barcode, articleNumber, addressee, deliveryAddress, phone, operatorId,
    officeId, requiresSignature, requiresPhoto, isCod, codAmount } = req.body;
  if (!barcode || !articleNumber || !addressee || !deliveryAddress || !officeId) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }
  const [article] = await db.insert(articlesTable).values({
    barcode, articleNumber, addressee, deliveryAddress,
    phone: phone ?? null, operatorId: operatorId ?? null, officeId,
    requiresSignature: requiresSignature ?? false,
    requiresPhoto: requiresPhoto ?? false,
    isCod: isCod ?? false, codAmount: codAmount ?? null,
    status: "pending",
  }).returning();
  res.status(201).json(formatArticle(article));
});

router.get("/articles/scan/:barcode", requireAuth, async (req, res): Promise<void> => {
  const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.barcode, barcode));
  if (!article) { res.status(404).json({ error: "not_found", message: "Article not found" }); return; }
  res.json(formatArticle(article));
});

router.get("/articles/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!article) { res.status(404).json({ error: "not_found", message: "Article not found" }); return; }
  res.json(formatArticle(article));
});

router.put("/articles/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, deliveryReason, gpsLat, gpsLng, operatorId } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === "delivered") updates.deliveredAt = new Date();
  }
  if (deliveryReason !== undefined) updates.deliveryReason = deliveryReason;
  if (gpsLat !== undefined) updates.gpsLat = gpsLat;
  if (gpsLng !== undefined) updates.gpsLng = gpsLng;
  if (operatorId !== undefined) updates.operatorId = operatorId;
  const [article] = await db.update(articlesTable).set(updates).where(eq(articlesTable.id, id)).returning();
  if (!article) { res.status(404).json({ error: "not_found", message: "Article not found" }); return; }
  res.json(formatArticle(article));
});

export default router;
