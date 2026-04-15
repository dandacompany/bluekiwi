export type DbDialect = "postgres" | "sqlite";

export interface DbQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbMutationResult {
  rowCount: number;
  lastInsertId?: number;
}

export interface DbTransactionClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>>;
  execute(text: string, params?: unknown[]): Promise<DbMutationResult>;
}

export interface DbAdapter {
  readonly dialect: DbDialect;

  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<DbQueryResult<T>>;

  execute(text: string, params?: unknown[]): Promise<DbMutationResult>;

  transaction<T>(fn: (client: DbTransactionClient) => Promise<T>): Promise<T>;
}
