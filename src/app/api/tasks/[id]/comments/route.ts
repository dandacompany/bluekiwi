import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  TaskComment,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const comments = await query<TaskComment>(
    "SELECT * FROM task_comments WHERE task_id = $1 ORDER BY step_order ASC, created_at DESC",
    [Number(id)],
  );
  const res = listResponse(comments, comments.length);
  return NextResponse.json(res.body, { status: res.status });
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { step_order, comment } = body;

  if (
    !step_order ||
    !comment ||
    typeof comment !== "string" ||
    !comment.trim()
  ) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "step_order and comment are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const commentId = await insert(
    "INSERT INTO task_comments (task_id, step_order, comment) VALUES ($1, $2, $3) RETURNING id",
    [Number(id), Number(step_order), comment.trim()],
  );

  const created = await queryOne<TaskComment>(
    "SELECT * FROM task_comments WHERE id = $1",
    [commentId],
  );

  const res = okResponse(created, 201);
  return NextResponse.json(res.body, { status: res.status });
}
