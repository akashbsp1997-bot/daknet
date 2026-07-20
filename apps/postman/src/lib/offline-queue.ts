// Offline write queue for field operators working with unreliable
// connectivity. Actions that create/update server records (recording a
// visit, updating an article's delivery status) get written here first —
// instantly, regardless of network state — then replayed against the real
// API once connectivity returns. This is intentionally scoped to writes
// only; it does not cache reads (dashboard/article lists still need one
// successful load per app session).
import { openDB, type IDBPDatabase } from "idb";
import { createVisit, updateArticle, ApiError, type CreateVisitRequest, type UpdateArticleRequest } from "@workspace/api-client-react";

interface QueueItemBase {
  id: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface VisitQueueItem extends QueueItemBase {
  kind: "visit";
  payload: CreateVisitRequest;
}

export interface ArticleUpdateQueueItem extends QueueItemBase {
  kind: "articleUpdate";
  articleId: string;
  payload: UpdateArticleRequest;
}

export type QueueItem = VisitQueueItem | ArticleUpdateQueueItem;

const DB_NAME = "postman-offline-queue";
const STORE_NAME = "outbox";
const MAX_ATTEMPTS = 5;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

async function put(item: QueueItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, item);
}

async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await getDb();
  const items = (await db.getAll(STORE_NAME)) as QueueItem[];
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

function makeId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueVisit(payload: CreateVisitRequest): Promise<void> {
  await put({ id: makeId(), kind: "visit", payload, createdAt: Date.now(), attempts: 0 });
  notify();
  void flushQueue();
}

export async function enqueueArticleUpdate(articleId: string, payload: UpdateArticleRequest): Promise<void> {
  await put({ id: makeId(), kind: "articleUpdate", articleId, payload, createdAt: Date.now(), attempts: 0 });
  notify();
  void flushQueue();
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to queue changes (item added, synced, or failed). Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

let flushing = false;

/**
 * Replays queued items against the real API, oldest first. A genuine HTTP
 * response (validation error, etc.) means the request reached the server
 * and was rejected — retrying it unchanged won't help, so it's dropped
 * after a few attempts rather than blocking everything behind it forever.
 * A network-level failure (no `status` on the error) means we're likely
 * offline again — stop and leave the rest queued in order.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (!navigator.onLine) return;
  flushing = true;
  try {
    const items = await getQueue();
    for (const item of items) {
      try {
        if (item.kind === "visit") {
          await createVisit(item.payload);
        } else {
          await updateArticle(item.articleId, item.payload);
        }
        await remove(item.id);
        notify();
      } catch (err) {
        if (err instanceof ApiError) {
          const attempts = item.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await remove(item.id);
          } else {
            await put({ ...item, attempts, lastError: err.message });
          }
          notify();
        } else {
          // Not an ApiError => the request never got a response at all.
          break;
        }
      }
    }
  } finally {
    flushing = false;
  }
}

let initialized = false;

/** Call once at app startup. */
export function initOfflineSync(): void {
  if (initialized) return;
  initialized = true;
  window.addEventListener("online", () => void flushQueue());
  // Some mobile browsers don't fire 'online' reliably when the app was
  // backgrounded, so poll as a fallback.
  setInterval(() => void flushQueue(), 30_000);
  void flushQueue();
}
