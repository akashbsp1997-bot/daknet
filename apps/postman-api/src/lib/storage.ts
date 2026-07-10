import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Did you forget to set up the R2 bucket?`);
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * Uploads a photo buffer to R2 (private bucket) and returns its storage
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
