import { NextRequest, NextResponse } from "next/server";
import { errorResponse, execute, okResponse, queryOne } from "@/lib/db";
import { checkPermission, type User } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

type ApiKeyOwnerRow = {
  id: number;
  user_id: number;
  is_revoked: boolean;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const DELETE = withAuth(
  "apikeys:read_own",
  async (_request: NextRequest, user: User, { params }: Params) => {
    void _request;

    const { id } = await params;
    const apiKeyId = parseId(id);

    if (!apiKeyId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const apiKey = await queryOne<ApiKeyOwnerRow>(
      "SELECT id, user_id, is_revoked FROM api_keys WHERE id = $1",
      [apiKeyId],
    );
    if (!apiKey) {
      const res = errorResponse("NOT_FOUND", "api key not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const canRevokeAll = checkPermission(user.role, "apikeys:revoke_all");
    if (!canRevokeAll && apiKey.user_id !== user.id) {
      const res = errorResponse("FORBIDDEN", "forbidden", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("UPDATE api_keys SET is_revoked = true WHERE id = $1", [
      apiKeyId,
    ]);

    const res = okResponse({ id: apiKeyId, is_revoked: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
