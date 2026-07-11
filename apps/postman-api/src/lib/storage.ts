import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const required = ["SUPABASE_S3_ENDPOINT", "SUPABASE_S3_REGION", "SUPABASE_S3_ACCESS_KEY_ID", "SUPABASE_S3_SECRET_ACCESS_KEY", "SUPABASE_S3_BUCKET_NAME"] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Did you forget to set up Supabase Storage?`);
  }
}

const s3 = new S3Client({
  region: process.env.SUPABASE_S3_REGION!,
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  // Supabase's S3-compatible endpoint requires path-style addressing
  // (endpoint/bucket/key) — R2 didn't need this, Supabase does.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.SUPABASE_S3_BUCKET_NAME!;

/**
 * Uploads a photo buffer to Supabase Storage (private bucket) and returns its storage
 * KEY — not a public URL. The bucket stays private on purpose: these are
 * photos of addresses and delivery evidence, tied to a government identity-
 * verification workflow, not public product images.
 */
export async function uploadPhoto(
  buffer: Buffer,
  mimeType: string,
  folder: "visits" | "addresses",
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const key = `${folder}/${randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimeType }));
  return key;
}

/** Turns a stored key into a time-limited signed URL the client can actually load. */
export async function getPhotoUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}
