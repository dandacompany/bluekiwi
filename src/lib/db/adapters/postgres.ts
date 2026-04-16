import { Pool, PoolClient } from "pg";
import { getDatabaseConfig } from "../config";
import type {
  DbAdapter,
  DbMutationResult,
  DbQueryResult,
  DbTransactionClient,
} from "../adapter";

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    const config = getDatabaseConfig();
    if (!config.connectionString) {
      throw new Error("DATABASE_URL is required for postgres mode");
    }
    pool = new Pool({ connectionString: config.connectionString, max: 20 });
  }
  return pool;
}

async function queryWithClient<T = Record<string, unknown>>(
  client: Pick<Pool, "query"> | PoolClient,
  text: string,
  params?: unknown[],
): Promise<DbQueryResult<T>> {
  const result = await client.query(text, params);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? 0,
  };
}

async function executeWithClient(
  client: Pick<Pool, "query"> | PoolClient,
  text: string,
  params?: unknown[],
): Promise<DbMutationResult> {
  const result = await client.query(text, params);
  const firstRow = result.rows[0] as { id?: number } | undefined;
  return {
    rowCount: result.rowCount ?? 0,
    lastInsertId: typeof firstRow?.id === "number" ? firstRow.id : undefined,
  };
}

export const postgresAdapter: DbAdapter = {
  dialect: "postgres",
  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>> {
    return queryWithClient<T>(getPostgresPool(), text, params);
  },
  async execute(text: string, params?: unknown[]): Promise<DbMutationResult> {
    return executeWithClient(getPostgresPool(), text, params);
  },
  async transaction<T>(
    fn: (client: DbTransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await getPostgresPool().connect();
    try {
      await client.query("BEGIN");
      const txClient: DbTransactionClient = {
        query: <R = Record<string, unknown>>(
          text: string,
          params?: unknown[],
        ) => queryWithClient<R>(client, text, params),
        execute: (text: string, params?: unknown[]) =>
          executeWithClient(client, text, params),
      };
      const result = await fn(txClient);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
