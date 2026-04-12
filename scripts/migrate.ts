/**
 * Auto-migration runner.
 *
 * Reads docker/migrations/*.sql, compares against schema_migrations table,
 * and applies any missing migrations in order. Safe to run on every deploy —
 * already-applied migrations are skipped.
 *
 * Usage:  node scripts/migrate.js          (after tsc/esbuild)
 *         npx tsx scripts/migrate.ts       (dev)
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5433/bluekiwi";

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "../docker/migrations");

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    // 1. Ensure tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Get already-applied migrations
    const { rows: applied } = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename",
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // 3. Read migration files from disk
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log("[migrate] No migrations directory found, skipping.");
      return;
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // 4. Apply missing migrations in order
    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`[migrate] applying ${file}`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED on ${file}:`, err);
        process.exit(1);
      } finally {
        client.release();
      }
    }

    if (count === 0) {
      console.log(`[migrate] up to date (${files.length} migrations tracked)`);
    } else {
      console.log(`[migrate] applied ${count} migration(s)`);
    }
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
