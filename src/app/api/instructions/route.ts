import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  Instruction,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

export const GET = withOptionalAuth(
  "instructions:read",
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;

    const agentType = searchParams.get("agent_type");
    const activeOnly = searchParams.get("active_only") === "true";
    const q = searchParams.get("q");
    const tag = searchParams.get("tag");

    let sql =
      "SELECT id, title, content, agent_type, tags, priority, is_active, created_at, updated_at FROM instructions WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 0;

    if (agentType) {
      paramIdx++;
      sql += ` AND agent_type = $${paramIdx}`;
      params.push(agentType);
    }
    if (activeOnly) {
      sql += " AND is_active = 1";
    }
    if (q) {
      paramIdx++;
      const likeIdx = paramIdx;
      paramIdx++;
      sql += ` AND (title LIKE $${likeIdx} OR content LIKE $${paramIdx})`;
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (tag) {
      paramIdx++;
      sql += ` AND tags::jsonb ? $${paramIdx}`;
      params.push(tag);
    }

    sql += " ORDER BY priority DESC, updated_at DESC";

    const rows = await query<Instruction>(sql, params);
    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withOptionalAuth(
  "instructions:write",
  async (request: NextRequest) => {
    const body = await request.json();
    const { title, content, agent_type, tags, priority } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const tagsJson = JSON.stringify(
      Array.isArray(tags) ? tags.map((t: string) => t.trim()) : [],
    );

    const instructionId = await insert(
      "INSERT INTO instructions (title, content, agent_type, tags, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        title.trim(),
        (content ?? "").trim(),
        (agent_type ?? "general").trim(),
        tagsJson,
        typeof priority === "number" ? priority : 0,
      ],
    );

    const created = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [instructionId],
    );

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
