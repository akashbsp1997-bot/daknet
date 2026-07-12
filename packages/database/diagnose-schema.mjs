// One-off diagnostic for the "Failed query" error against user_offices seen
// in production: checks whether PostGIS is enabled and whether the
// offices/user_offices tables actually exist, then runs the exact failing
// query directly to surface the real Postgres error (not drizzle's generic
// wrapper message).
//
// Usage: pnpm --filter @workspace/db exec node diagnose-schema.mjs

import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in this environment.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  console.log("--- Installed extensions ---");
  const ext = await client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname");
  console.log(ext.rows);

  console.log("\n--- Table existence ---");
  const tables = await client.query(`
    SELECT to_regclass('public.users') AS users,
           to_regclass('public.offices') AS offices,
           to_regclass('public.user_offices') AS user_offices,
           to_regclass('public.beats') AS beats
  `);
  console.log(tables.rows[0]);

  console.log("\n--- user_offices columns (if it exists) ---");
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_offices'
    ORDER BY ordinal_position
  `);
  console.log(cols.rows);

  console.log("\n--- Running the exact failing query ---");
  try {
    const result = await client.query(
      `select "office_id" from "user_offices" where "user_offices"."user_id" = $1`,
      ["00000000-0000-0000-0000-000000000000"],
    );
    console.log("Query succeeded. Row count:", result.rowCount);
  } catch (err) {
    console.log("Query failed with the real Postgres error:");
    console.log("  message:", err.message);
    console.log("  code:", err.code);
    console.log("  detail:", err.detail);
    console.log("  hint:", err.hint);
    console.log("  where:", err.where);
  }
} finally {
  await client.end();
}
