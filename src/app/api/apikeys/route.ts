import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  insert,
  listResponse,
  okResponse,
  query,
  queryOne,
} from "@/lib/db";
import { generateApiKey, type User } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";

type ApiKeyPublic = {
  id: number;
  prefix: string;
  name: string;
  user_id: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
};

export const GET = withAuth(
  "apikeys:read_own",
  async (_request, user: User) => {
    const keys =
      user.role === "superuser"
        ? await query<ApiKeyPublic>(
            `SELECT a.id, a.prefix, a.name, a.user_id, a.last_used_at, a.expires_at, a.is_revoked, a.created_at, u.username AS owner_name
             FROM api_keys a JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC`,
          )
        : await query<ApiKeyPublic>(
            "SELECT id, prefix, name, user_id, last_used_at, expires_at, is_revoked, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
            [user.id],
          );

    const res = listResponse(keys, keys.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth(
  "apikeys:create",
  async (request: NextRequest, user: User) => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name;
    const expiresInDays = body.expires_in_days;

    let nameValue = "";
    if (name !== undefined) {
      if (name === null) {
        nameValue = "";
      } else if (typeof name === "string") {
        nameValue = name.trim();
      } else {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "name must be a string",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    let expiresAt: string | null = null;
    if (expiresInDays !== undefined) {
      if (
        typeof expiresInDays !== "number" ||
        !Number.isFinite(expiresInDays) ||
        !Number.isInteger(expiresInDays) ||
        expiresInDays <= 0
      ) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "expires_in_days must be a positive integer",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }

      const ms = expiresInDays * 24 * 60 * 60 * 1000;
      expiresAt = new Date(Date.now() + ms).toISOString();
    }

    const { rawKey, prefix, keyHash } = generateApiKey();

    const apiKeyId = await insert(
      "INSERT INTO api_keys (user_id, key_hash, prefix, name, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [user.id, keyHash, prefix, nameValue, expiresAt],
    );

    const created = await queryOne<ApiKeyPublic>(
      "SELECT id, prefix, name, user_id, last_used_at, expires_at, is_revoked, created_at FROM api_keys WHERE id = $1",
      [apiKeyId],
    );

    const res = okResponse({ api_key: created ?? null, raw_key: rawKey }, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
