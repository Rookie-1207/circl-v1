import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Do NOT throw here at module-load time. The server startup in
// artifacts/api-server/src/index.ts validates DATABASE_URL before
// dynamically importing this module, so by the time this code runs
// DATABASE_URL is guaranteed to be present. A module-load-time throw would
// crash the process before the HTTP server could start and serve the health
// probe, causing every Cloud Run deployment to fail at the promote step.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
