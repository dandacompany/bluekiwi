import { NextResponse } from "next/server";
import {
  query,
  queryOne,
  type Credential,
  type CredentialShare,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canListCredential,
  canManageCredentialShares,
} from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "credentials:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const cred = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );
    if (!cred) {
      const res = errorResponse("NOT_FOUND", "크레덴셜 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canListCredential(user, cred))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 거부", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const rows = await query<CredentialShare & { group_name: string }>(
      `SELECT cs.*, ug.name AS group_name
         FROM credential_shares cs
         JOIN user_groups ug ON ug.id = cs.group_id
         WHERE cs.credential_id = $1 ORDER BY ug.name ASC`,
      [Number(id)],
    );
    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "credentials:write",
  async (request, user, { params }) => {
    const { id } = await params;
    const { group_id, access_level } = await request.json();
    if (
      typeof group_id !== "number" ||
      !["use", "manage"].includes(access_level)
    ) {
      const res = errorResponse("VALIDATION_ERROR", "invalid body", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    const cred = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );
    if (!cred) {
      const res = errorResponse("NOT_FOUND", "크레덴셜 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canManageCredentialShares(user, cred))) {
      const res = errorResponse(
        "CREDENTIAL_REVEAL_DENIED",
        "공유 관리 권한 없음",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const row = await queryOne<CredentialShare>(
      `INSERT INTO credential_shares (credential_id, group_id, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (credential_id, group_id)
       DO UPDATE SET access_level = EXCLUDED.access_level RETURNING *`,
      [Number(id), group_id, access_level],
    );
    const res = okResponse(row, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
