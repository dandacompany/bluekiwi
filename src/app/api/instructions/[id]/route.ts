import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  Instruction,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = errorResponse("NOT_FOUND", "지침을 찾을 수 없습니다", 404);

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }: Params) => {
    const { id } = await params;

    const row = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );

    if (!row) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const { canRead } = await import("@/lib/authorization");
    if (!(await canRead(user, row))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse(row);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const { title, content, agent_type, tags, priority, is_active } = body;

    const existing = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );

    if (!existing) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const { canEdit } = await import("@/lib/authorization");
    if (!(await canEdit(user, existing))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "편집 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const newTags =
      tags !== undefined
        ? JSON.stringify(
            Array.isArray(tags) ? tags.map((t: string) => t.trim()) : [],
          )
        : existing.tags;

    await execute(
      `UPDATE instructions
     SET title = $1, content = $2, agent_type = $3, tags = $4, priority = $5, is_active = $6, updated_at = NOW()
     WHERE id = $7`,
      [
        (title ?? existing.title).trim(),
        (content ?? existing.content).trim(),
        (agent_type ?? existing.agent_type).trim(),
        newTags,
        typeof priority === "number" ? priority : existing.priority,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        Number(id),
      ],
    );

    const updated = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );

    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:delete",
  async (_request, user, { params }: Params) => {
    const { id } = await params;

    const existing = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );
    if (!existing) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const { canDelete } = await import("@/lib/authorization");
    if (!(await canDelete(user, existing))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "삭제 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Refuse delete if any workflow_nodes still reference this instruction.
    // The DB-level RESTRICT FK is the ultimate guard, but we front-load a
    // friendly count-aware error so the UI can show something meaningful.
    const refs = await queryOne<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM workflow_nodes WHERE instruction_id = $1",
      [Number(id)],
    );
    const refCount = Number(refs?.c ?? 0);
    if (refCount > 0) {
      const res = errorResponse(
        "INSTRUCTION_IN_USE",
        `이 지침은 ${refCount}개의 워크플로 노드에서 사용 중이라 삭제할 수 없습니다. 해당 워크플로에서 먼저 지침을 분리하세요.`,
        409,
        { count: refCount },
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const result = await execute("DELETE FROM instructions WHERE id = $1", [
      Number(id),
    ]);

    if (result.rowCount === 0) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
