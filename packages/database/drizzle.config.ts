import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Without this, drizzle-kit also tries to introspect Supabase's own
  // auth/storage/realtime schemas alongside our tables in public — and
  // crashes on constructs inside those (composite keys, certain default
  // expressions) that its introspection doesn't handle. We only own public;
  // this stops it from touching anything else.
  schemaFilter: ["public"],
});
