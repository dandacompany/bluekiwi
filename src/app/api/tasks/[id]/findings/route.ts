import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  ComplianceFinding,
  Task,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

const SEVERITY_VALUES = new Set(["BLOCK", "REVIEW", "WARN", "INFO"]);

export const GET = withAuth<Params>(
  "tasks:read",
  async (_request, _user, { params }) => {
    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isFinite(taskId)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "유효하지 않은 태스크 ID",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const task = await queryOne<Task>("SELECT id FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (!task) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const rows = await query<ComplianceFinding>(
      `SELECT id, task_id, step_order, rule_id, severity, summary, detail, fix,
              authority, file_path, line_number, source, metadata, created_at
       FROM compliance_findings
       WHERE task_id = $1
       ORDER BY created_at ASC, id ASC`,
      [taskId],
    );

    const res = okResponse({ findings: rows, total: rows.length });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "tasks:execute",
  async (request: NextRequest, _user, { params }) => {
    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isFinite(taskId)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "유효하지 않은 태스크 ID",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const task = await queryOne<Task>("SELECT id FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (!task) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const body = await request.json();
    const raw = Array.isArray(body?.findings) ? body.findings : null;
    if (!raw || raw.length === 0) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "findings 배열이 필요합니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // Validate each finding
    for (let i = 0; i < raw.length; i += 1) {
      const f = raw[i];
      if (!f || typeof f !== "object") {
        const res = errorResponse(
          "VALIDATION_ERROR",
          `findings[${i}]는 객체여야 합니다`,
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (typeof f.rule_id !== "string" || f.rule_id.length === 0) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          `findings[${i}].rule_id는 필수 문자열입니다`,
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (typeof f.severity !== "string" || !SEVERITY_VALUES.has(f.severity)) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          `findings[${i}].severity는 BLOCK/REVIEW/WARN/INFO 중 하나여야 합니다`,
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (typeof f.summary !== "string" || f.summary.length === 0) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          `findings[${i}].summary는 필수 문자열입니다`,
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    const insertedIds: number[] = [];
    for (const f of raw) {
      const stepOrder = Number.isFinite(f.step_order)
        ? Number(f.step_order)
        : null;
      const lineNumber = Number.isFinite(f.line_number)
        ? Number(f.line_number)
        : null;
      const insertedId = await insert(
        `INSERT INTO compliance_findings
          (task_id, step_order, rule_id, severity, summary, detail, fix,
           authority, file_path, line_number, source, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          taskId,
          stepOrder,
          f.rule_id,
          f.severity,
          f.summary,
          typeof f.detail === "string" ? f.detail : null,
          typeof f.fix === "string" ? f.fix : null,
          typeof f.authority === "string" ? f.authority : null,
          typeof f.file_path === "string" ? f.file_path : null,
          lineNumber,
          typeof f.source === "string" ? f.source : null,
          f.metadata !== undefined ? JSON.stringify(f.metadata) : null,
        ],
      );
      insertedIds.push(insertedId);
    }

    const res = okResponse(
      { inserted: insertedIds.length, ids: insertedIds },
      201,
    );
    return NextResponse.json(res.body, { status: res.status });
  },
);
