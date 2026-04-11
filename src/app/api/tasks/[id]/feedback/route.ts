import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, okResponse, errorResponse } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

interface FeedbackItem {
  question: string;
  answer: string;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { feedback } = body as { feedback: FeedbackItem[] };

  if (!Array.isArray(feedback) || feedback.length === 0) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "feedback must be a non-empty array of {question, answer} objects",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  for (const item of feedback) {
    if (typeof item.question !== "string" || typeof item.answer !== "string") {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "each feedback item must have question and answer strings",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  const task = await queryOne<{ id: number }>(
    "SELECT id FROM tasks WHERE id = $1",
    [taskId],
  );
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute(
    "UPDATE tasks SET feedback_data = $1, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(feedback), taskId],
  );

  const res = okResponse({ task_id: taskId, feedback_saved: feedback.length });
  return NextResponse.json(res.body, { status: res.status });
}
