import { NextResponse } from "next/server";
import {
  queryOne,
  execute,
  type Credential,
  okResponse,
  errorResponse,
  maskSecrets,
} from "@/lib/db";
import {
  canDelete,
  canEditCredential,
  canListCredential,
} from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import { loadResourceOrFail, withResource } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET: canListCredential; if canReveal=false, return masked
export const GET = withResource<Credential>({
  permission: "credentials:read",
  table: "credentials",
  check: canListCredential,
  notFoundMessage: "크레덴셜 없음",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource: cred }) => {
    const res = okResponse({
      ...cred,
      secrets_masked: maskSecrets(cred.secrets),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
});

// PUT: canEditCredential
export const PUT = withAuth<Params>(
  "credentials:write",
  async (request, user, { params }) => {
    const { id } = await params;
    const body = await request.json();

    const { response: errResp } = await loadResourceOrFail<Credential>({
      table: "credentials",
      id,
      user,
      check: canEditCredential,
      notFoundMessage: "크레덴셜 없음",
      forbiddenCode: "CREDENTIAL_REVEAL_DENIED",
      forbiddenMessage: "수정 권한 없음",
    });
    if (errResp) return errResp;

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
      secrets_masked: maskSecrets(updated!.secrets),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

// DELETE: canDelete
export const DELETE = withAuth<Params>(
  "credentials:write",
  async (_request, user, { params }) => {
    const { id } = await params;

    const { response: errResp } = await loadResourceOrFail<Credential>({
      table: "credentials",
      id,
      user,
      check: (u, c) => canDelete(u, c as never),
      notFoundMessage: "크레덴셜 없음",
      forbiddenMessage: "삭제 권한 없음",
    });
    if (errResp) return errResp;

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
        { count: refCount },
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM credentials WHERE id = $1", [Number(id)]);
    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
