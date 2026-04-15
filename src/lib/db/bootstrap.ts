import { getDatabaseConfig } from "./config";
import { runSqliteMigrations } from "./migrations/sqlite";

let bootstrapPromise: Promise<void> | null = null;

async function bootstrapDatabase(): Promise<void> {
  const config = getDatabaseConfig();

  if (config.type !== "sqlite") {
    return;
  }

  if (!config.sqlitePath) {
    throw new Error("SQLITE_PATH is required for sqlite bootstrap");
  }

  await runSqliteMigrations({
    sqlitePath: config.sqlitePath,
  });
}

export async function ensureDatabaseBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapDatabase().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}
