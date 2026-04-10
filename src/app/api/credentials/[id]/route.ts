import { NextResponse } from "next/server";
import {
  queryOne,
  execute,
  type Credential,
  okResponse,
  errorResponse,
  maskSecrets,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

// GET: canListCredential; if canReveal=false, return masked
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
    const { canListCredential } = await import("@/lib/authorization");
    if (!(await canListCredential(user, cred))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const res = okResponse({
      ...cred,
      secrets: JSON.stringify(maskSecrets(cred.secrets)),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

// PUT: canEditCredential
export const PUT = withAuth<Params>(
  "credentials:write",
  async (request, user, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const cred = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );
    if (!cred) {
      const res = errorResponse("NOT_FOUND", "크레덴셜 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    const { canEditCredential } = await import("@/lib/authorization");
    if (!(await canEditCredential(user, cred))) {
      const res = errorResponse(
        "CREDENTIAL_REVEAL_DENIED",
        "수정 권한 없음",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const updated = await queryOne<Credential>(
      `UPDATE credentials SET
         service_name = COALESCE($1, service_name),
         description = COALESCE($2, description),
         secrets = COALESCE($3, secrets),
         folder_id = COALESCE($4, folder_id),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        body.service_name ?? null,
        body.description ?? null,
        body.secrets ?? null,
        body.folder_id ?? null,
        Number(id),
      ],
    );
    const res = okResponse({
      ...updated!,
      secrets: JSON.stringify(maskSecrets(updated!.secrets)),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

// DELETE: canDelete
export const DELETE = withAuth<Params>(
  "credentials:write",
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
    const { canDelete } = await import("@/lib/authorization");
    if (!(await canDelete(user, cred as never))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "삭제 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Refuse delete if any workflow_nodes still reference this credential.
    // The DB-level RESTRICT FK is the ultimate guard; the application layer
    // adds a friendly count-aware 409 on top so the UI can explain clearly.
    const refs = await queryOne<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM workflow_nodes WHERE credential_id = $1",
      [Number(id)],
    );
    const refCount = Number(refs?.c ?? 0);
    if (refCount > 0) {
      const res = errorResponse(
        "CREDENTIAL_IN_USE",
        `이 크레덴셜은 ${refCount}개의 워크플로 노드에서 사용 중이라 삭제할 수 없습니다. 해당 워크플로에서 먼저 크레덴셜을 분리하세요.`,
        409,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM credentials WHERE id = $1", [Number(id)]);
    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
