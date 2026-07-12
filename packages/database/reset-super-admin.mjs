// Recovery tool for a locked-out super-admin login: talks directly to the
// database (not through postman-api), so it works even when you don't have
// a valid session at all. Upserts the account so SUPER_ADMIN_USERNAME /
// SUPER_ADMIN_PASSWORD (from .env, or already-exported env vars) always
// wins — creating the account if it's missing, or resetting its password,
// role, and active status to match if it already exists. Existing refresh
// tokens for that account are revoked so old sessions can't linger.
//
// Usage (from repo root):
//   pnpm --filter @workspace/db exec node reset-super-admin.mjs
//   pnpm --filter @workspace/db exec node reset-super-admin.mjs --dry-run

import { readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const DRY_RUN = process.argv.includes("--dry-run");

async function loadRootEnvFile() {
  const envPath = path.resolve(import.meta.dirname, "..", "..", ".env");
  let text;
  try {
    text = await readFile(envPath, "utf8");
  } catch {
    return; // no .env at repo root — that's fine, rely on already-exported vars
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't clobber a value the environment already provided (e.g. in CI).
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

await loadRootEnvFile();

const { DATABASE_URL, SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD } = process.env;

for (const [name, value] of Object.entries({ DATABASE_URL, SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD })) {
  if (!value) {
    console.error(`${name} is not set. Fill it into .env at the repo root, or export it directly.`);
    process.exit(1);
  }
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const { rows } = await client.query("SELECT id FROM users WHERE username = $1", [SUPER_ADMIN_USERNAME]);
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  if (rows.length > 0) {
    const userId = rows[0].id;
    console.log(`Found existing user "${SUPER_ADMIN_USERNAME}" (${userId}).`);
    if (DRY_RUN) {
      console.log("Dry run — would reset its password, set role=super_admin, isActive=true, and revoke its refresh tokens.");
    } else {
      await client.query(
        `UPDATE users SET password_hash = $1, role = 'super_admin', is_active = true WHERE id = $2`,
        [passwordHash, userId],
      );
      const { rowCount } = await client.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
      console.log(`Password reset. Role set to super_admin, account reactivated. Revoked ${rowCount} refresh token(s).`);
    }
  } else {
    console.log(`No user "${SUPER_ADMIN_USERNAME}" exists yet.`);
    if (DRY_RUN) {
      console.log("Dry run — would create it as a new super_admin account.");
    } else {
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'super_admin', true)`,
        [SUPER_ADMIN_USERNAME, passwordHash, "Super Administrator"],
      );
      console.log("Created new super_admin account.");
    }
  }
} finally {
  await client.end();
}
