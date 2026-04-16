import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import { execute, queryOne } from "@/lib/db";
import type { ApiKey, User } from "@/lib/auth";

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: User["role"];
  is_active: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ApiKeyRow {
  id: number;
  user_id: number;
  key_hash: string;
  prefix: string;
  name: string;
  last_used_at: string | Date | null;
  expires_at: string | Date | null;
  is_revoked: boolean | number | string;
  created_at: string | Date;
}

interface LoginUserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: User["role"];
  must_change_password: boolean | number | string;
}

export interface LoginUser {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: User["role"];
  must_change_password: boolean;
}

function normalizeUser(row: UserRow): User {
  return {
    ...row,
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeApiKey(row: ApiKeyRow): ApiKey {
  return {
    ...row,
    last_used_at: decodeTimestamp(row.last_used_at),
    expires_at: decodeTimestamp(row.expires_at),
    is_revoked: decodeBoolean(row.is_revoked),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

function normalizeLoginUser(row: LoginUserRow): LoginUser {
  return {
    ...row,
    must_change_password: decodeBoolean(row.must_change_password),
  };
}

export async function findActiveUserById(userId: number): Promise<User | null> {
  const row = await queryOne<UserRow>(
    "SELECT * FROM users WHERE id = $1 AND is_active = true",
    [userId],
  );
  return row ? normalizeUser(row) : null;
}

export async function findLoginUserByEmail(
  email: string,
): Promise<LoginUser | null> {
  const row = await queryOne<LoginUserRow>(
    "SELECT id, username, email, password_hash, role, must_change_password FROM users WHERE email = $1",
    [email],
  );
  return row ? normalizeLoginUser(row) : null;
}

export async function findActiveApiKeyByHash(
  keyHash: string,
): Promise<ApiKey | null> {
  const row = await queryOne<ApiKeyRow>(
    "SELECT * FROM api_keys WHERE key_hash = $1 AND is_revoked = false",
    [keyHash],
  );
  return row ? normalizeApiKey(row) : null;
}

export async function touchApiKeyLastUsedAt(apiKeyId: number): Promise<void> {
  await execute("UPDATE api_keys SET last_used_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    apiKeyId,
  ]);
}
