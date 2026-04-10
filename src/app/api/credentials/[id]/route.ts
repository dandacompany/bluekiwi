import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  Credential,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = errorResponse(
  "NOT_FOUND",
  "크리덴셜을 찾을 수 없습니다",
  404,
);

function toMaskedCredential(row: Credential) {
  const { secrets, ...rest } = row;
  return { ...rest, secrets_masked: maskSecrets(secrets) };
}

export const GET = withOptionalAuth<Params>(
  "credentials:read",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const row = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );

    if (!row) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const linkedNodes = await query<{ cnt: string }>(
      "SELECT COUNT(*)::text AS cnt FROM workflow_nodes WHERE credential_id = $1",
      [Number(id)],
    );
    const linked_nodes = Number(linkedNodes[0]?.cnt ?? 0);

    const res = okResponse({ ...toMaskedCredential(row), linked_nodes });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withOptionalAuth<Params>(
  "credentials:write",
  async (request: NextRequest, _user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const { service_name, description, secrets } = body;

    const existing = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );

    if (!existing) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    // secrets 병합: 빈 값이면 기존 유지
    let mergedSecretsJson = existing.secrets;
    if (secrets && typeof secrets === "object") {
      const existingSecrets = JSON.parse(existing.secrets) as Record<
        string,
        string
      >;
      const newSecrets = secrets as Record<string, string>;
      const merged: Record<string, string> = { ...existingSecrets };
      for (const [key, value] of Object.entries(newSecrets)) {
        if (typeof value === "string" && value.length > 0) {
          merged[key] = value;
        }
        // 빈 값이면 기존 유지
      }
      mergedSecretsJson = JSON.stringify(merged);
    }

    await execute(
      `UPDATE credentials
     SET service_name = $1, description = $2, secrets = $3, updated_at = NOW()
     WHERE id = $4`,
      [
        (service_name ?? existing.service_name).trim(),
        (description ?? existing.description).trim(),
        mergedSecretsJson,
        Number(id),
      ],
    );

    const updated = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );

    const res = okResponse(updated ? toMaskedCredential(updated) : null);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withOptionalAuth<Params>(
  "credentials:write",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const result = await execute("DELETE FROM credentials WHERE id = $1", [
      Number(id),
    ]);

    if (result.rowCount === 0) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
