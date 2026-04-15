/**
 * Auto-migration runner.
 *
 * Selects the active dialect from env/config and applies migrations using the
 * matching migration runner.
 *
 * Usage:  node scripts/migrate.js          (after tsc/esbuild)
 *         npx tsx scripts/migrate.ts       (dev)
 */

import path from "path";
import { getDatabaseConfig } from "../src/lib/db/config";
import { runPostgresMigrations } from "../src/lib/db/migrations/postgres";
import { runSqliteMigrations } from "../src/lib/db/migrations/sqlite";

async function migrate() {
  const config = getDatabaseConfig();

  if (config.type === "sqlite") {
    if (!config.sqlitePath) {
      throw new Error("SQLITE_PATH is required for sqlite migrations");
    }

    await runSqliteMigrations({
      sqlitePath: config.sqlitePath,
      migrationsDir:
        process.env.MIGRATIONS_DIR ??
        path.resolve(__dirname, "../src/lib/db/migrations/sqlite/sql"),
    });
    return;
  }

  if (!config.connectionString) {
    throw new Error("DATABASE_URL is required for postgres migrations");
  }

  await runPostgresMigrations({
    connectionString: config.connectionString,
    migrationsDir:
      process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "../docker/migrations"),
  });
}

migrate().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
