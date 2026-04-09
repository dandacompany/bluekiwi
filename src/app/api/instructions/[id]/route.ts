import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  Instruction,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = errorResponse("NOT_FOUND", "지침을 찾을 수 없습니다", 404);

export const GET = withOptionalAuth<Params>(
  "instructions:read",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const row = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );

    if (!row) {
      return NextResponse.json(NOT_FOUND.body, { status: NOT_FOUND.status });
    }

    const res = okResponse(row);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withOptionalAuth<Params>(
  "instructions:write",
  async (request: NextRequest, _user, { params }: Params) => {
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

export const DELETE = withOptionalAuth<Params>(
  "instructions:write",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

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
