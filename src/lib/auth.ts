import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";

// ─── Types ───

export type Role = "superuser" | "admin" | "editor" | "viewer";

export interface User {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: number;
  user_id: number;
  key_hash: string;
  prefix: string;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export interface UserGroup {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

// ─── Password Hashing ───

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── API Key Generation ───

const API_KEY_PREFIX = "bk_";
const API_KEY_BYTES = 32;

export function generateApiKey(): {
  rawKey: string;
  prefix: string;
  keyHash: string;
} {
  const bytes = randomBytes(API_KEY_BYTES);
  const rawKey = API_KEY_PREFIX + bytes.toString("base64url");
  const prefix = rawKey.slice(0, 10);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, prefix, keyHash };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// ─── API Key Validation ───

export async function validateApiKey(
  rawKey: string,
): Promise<{ user: User; apiKey: ApiKey } | null> {
  const keyHash = hashApiKey(rawKey);
  const apiKey = await queryOne<ApiKey>(
    `SELECT * FROM api_keys WHERE key_hash = $1 AND is_revoked = false`,
    [keyHash],
  );
  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null;
  }

  const user = await queryOne<User>(
    `SELECT * FROM users WHERE id = $1 AND is_active = true`,
    [apiKey.user_id],
  );
  if (!user) return null;

  // Update last_used_at (fire-and-forget)
  queryOne(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [
    apiKey.id,
  ]).catch(() => {});

  return { user, apiKey };
}

// ─── Role-Based Access Control ───

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  superuser: 3,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Permission matrix
export const PERMISSIONS = {
  // Workflow/Chain
  "workflows:read": "viewer" as Role,
  "workflows:create": "editor" as Role,
  "workflows:update": "editor" as Role,
  "workflows:delete": "editor" as Role,

  // Tasks
  "tasks:read": "viewer" as Role,
  "tasks:create": "editor" as Role,
  "tasks:execute": "viewer" as Role,

  // Credentials
  "credentials:read": "viewer" as Role,
  "credentials:write": "editor" as Role,

  // Users
  "users:read": "admin" as Role,
  "users:write": "admin" as Role,
  "users:create_admin": "superuser" as Role,

  // API Keys
  "apikeys:read_own": "viewer" as Role,
  "apikeys:create": "viewer" as Role,
  "apikeys:read_all": "admin" as Role,
  "apikeys:revoke_all": "admin" as Role,

  // Instructions
  "instructions:read": "viewer" as Role,
  "instructions:write": "editor" as Role,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function checkPermission(
  userRole: Role,
  permission: Permission,
): boolean {
  const requiredRole = PERMISSIONS[permission];
  return hasPermission(userRole, requiredRole);
}

// ─── Request Auth Helper ───

export async function authenticateRequest(
  authHeader: string | null,
): Promise<{ user: User; apiKey: ApiKey } | null> {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(bk_.+)$/i);
  if (!match) return null;

  return validateApiKey(match[1]);
}
