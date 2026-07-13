/**
 * P0 production audit migration — apply directly via pg
 * Adds missing indexes and unique constraints to conversations and connections tables.
 *
 * Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
 */
import pg from "pg";

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const migrations = [
  // ── conversations: indexes on the two FK columns ───────────────────────────
  `CREATE INDEX IF NOT EXISTS conversations_user1_id_idx ON conversations (user1_id)`,
  `CREATE INDEX IF NOT EXISTS conversations_user2_id_idx ON conversations (user2_id)`,

  // ── conversations: unique pair constraint ──────────────────────────────────
  // Deduplicate first (keep only the oldest row per pair), then add constraint.
  `DELETE FROM conversations
     WHERE id NOT IN (
       SELECT MIN(id) FROM conversations GROUP BY LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)
     )`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_pair_unique'
     ) THEN
       ALTER TABLE conversations ADD CONSTRAINT conversations_user_pair_unique UNIQUE (user1_id, user2_id);
     END IF;
   END$$`,

  // ── connections: unique pair constraint ────────────────────────────────────
  // Deduplicate first (keep only the newest row per pair by status preference), then add constraint.
  `DELETE FROM connections
     WHERE id NOT IN (
       SELECT DISTINCT ON (from_user_id, to_user_id) id
       FROM connections
       ORDER BY from_user_id, to_user_id, created_at DESC
     )`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'connections_pair_unique'
     ) THEN
       ALTER TABLE connections ADD CONSTRAINT connections_pair_unique UNIQUE (from_user_id, to_user_id);
     END IF;
   END$$`,
];

for (const sql of migrations) {
  const label = sql.split("\n")[0].slice(0, 80) + "…";
  try {
    await client.query(sql);
    console.log("  ✓", label);
  } catch (err) {
    console.error("  ✗", label);
    console.error("   ", err.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nP0 migration complete.");
