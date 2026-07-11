import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in this environment.");
  process.exit(1);
}

// Don't print the real value, but confirm shape without leaking the password
const masked = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":***@");
console.log("Attempting connection to:", masked);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const res = await client.query("SELECT current_database(), current_user, version()");
  console.log("Connected successfully.");
  console.log(res.rows[0]);
  await client.end();
} catch (err) {
  console.error("Connection failed.");
  console.error("message:", err?.message);
  console.error("code:", err?.code);
  process.exit(1);
}
