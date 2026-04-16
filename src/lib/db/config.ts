import path from "path";

export type DatabaseType = "postgres" | "sqlite";

export interface DatabaseConfig {
  type: DatabaseType;
  connectionString: string | null;
  sqlitePath: string | null;
}

const DEFAULT_POSTGRES_URL =
  "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5433/bluekiwi";
const DEFAULT_SQLITE_PATH = path.resolve(
  process.cwd(),
  ".data/bluekiwi.sqlite",
);

export function getDatabaseConfig(): DatabaseConfig {
  const type =
    (process.env.DB_TYPE?.toLowerCase() as DatabaseType | undefined) ??
    "postgres";

  if (type === "sqlite") {
    return {
      type,
      connectionString: null,
      sqlitePath: process.env.SQLITE_PATH ?? DEFAULT_SQLITE_PATH,
    };
  }

  return {
    type: "postgres",
    connectionString: process.env.DATABASE_URL ?? DEFAULT_POSTGRES_URL,
    sqlitePath: null,
  };
}
