import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getDatabaseConfig } from "../config";
import type {
  DbAdapter,
  DbMutationResult,
  DbQueryResult,
  DbTransactionClient,
} from "../adapter";

let db: Database.Database | null = null;

function resolveSqlitePath(): string {
  const config = getDatabaseConfig();
  if (!config.sqlitePath) {
    throw new Error("SQLITE_PATH is required for sqlite mode");
  }
  return config.sqlitePath;
}

function normalizeSql(text: string): string {
  return text.replace(/\$\d+/g, "?");
}

function normalizeBindingValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

function bindParams(text: string, params?: unknown[]): unknown[] {
  if (!params || params.length === 0) return [];
  const bound: unknown[] = [];
  for (const match of text.matchAll(/\$(\d+)/g)) {
    const originalIndex = Number(match[1]) - 1;
    bound.push(normalizeBindingValue(params[originalIndex]));
  }
  return bound;
}

function ensureDb(): Database.Database {
  if (db) return db;

  const sqlitePath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  db = new Database(sqlitePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

function runQuery<T = Record<string, unknown>>(
  database: Database.Database,
  text: string,
  params?: unknown[],
): DbQueryResult<T> {
  const sql = normalizeSql(text);
  const stmt = database.prepare(sql);
  const bound = bindParams(text, params);

  if (stmt.reader) {
    const rows = stmt.all(...bound) as T[];
    return { rows, rowCount: rows.length };
  }

  const result = stmt.run(...bound);
  return {
    rows: [],
    rowCount: Number(result.changes ?? 0),
  };
}

function runMutation(
  database: Database.Database,
  text: string,
  params?: unknown[],
): DbMutationResult {
  const sql = normalizeSql(text);
  const stmt = database.prepare(sql);
  const result = stmt.run(...bindParams(text, params));
  return {
    rowCount: Number(result.changes ?? 0),
    lastInsertId:
      typeof result.lastInsertRowid === "number"
        ? result.lastInsertRowid
        : Number(result.lastInsertRowid),
  };
}

export function getSqliteDatabase(): Database.Database {
  return ensureDb();
}

export const sqliteAdapter: DbAdapter = {
  dialect: "sqlite",
  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>> {
    return runQuery<T>(ensureDb(), text, params);
  },
  async execute(text: string, params?: unknown[]): Promise<DbMutationResult> {
    return runMutation(ensureDb(), text, params);
  },
  async transaction<T>(
    fn: (client: DbTransactionClient) => Promise<T>,
  ): Promise<T> {
    const database = ensureDb();
    const txClient: DbTransactionClient = {
      query: async <R = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ) => runQuery<R>(database, text, params),
      execute: async (text: string, params?: unknown[]) =>
        runMutation(database, text, params),
    };
    database.exec("BEGIN");
    try {
      const result = await fn(txClient);
      database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw error;
    }
  },
};
