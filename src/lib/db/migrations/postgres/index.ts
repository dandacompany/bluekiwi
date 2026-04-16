import { Pool } from "pg";
import fs from "fs";
import path from "path";

export async function runPostgresMigrations(options: {
  connectionString: string;
  migrationsDir?: string;
}): Promise<void> {
  const pool = new Pool({ connectionString: options.connectionString, max: 2 });
  const migrationsDir =
    options.migrationsDir ?? path.resolve(process.cwd(), "docker/migrations");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename",
    );
    const appliedSet = new Set(applied.map((row) => row.filename));

    if (!fs.existsSync(migrationsDir)) {
      console.log(
        "[migrate] No postgres migrations directory found, skipping.",
      );
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`[migrate] applying postgres ${file}`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        count += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED on postgres ${file}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    if (count === 0) {
      console.log(
        `[migrate] postgres up to date (${files.length} migrations tracked)`,
      );
    } else {
      console.log(`[migrate] applied ${count} postgres migration(s)`);
    }
  } finally {
    await pool.end();
  }
}
