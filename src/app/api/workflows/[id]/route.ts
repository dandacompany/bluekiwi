import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  withTransaction,
  Workflow,
  resolveNodes,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

interface NodeInput {
  title: string;
  instruction?: string;
  instruction_id?: number;
  credential_id?: number;
  node_type?: string;
  loop_back_to?: number;
  auto_advance?: boolean;
}

function jsonbParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function incrementWorkflowVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return "1.0";

  const match = trimmed.match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!match) return "1.0";

  const numericPrefix = match[1];
  const suffix = match[2];

  const parts = numericPrefix.split(".");
  const last = Number.parseInt(parts[parts.length - 1] ?? "0", 10);
  if (Number.isNaN(last)) return "1.0";
  parts[parts.length - 1] = String(last + 1);

  return parts.join(".") + suffix;
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }: Params) => {
    const { id } = await params;
    const workflow = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [Number(id)],
    );
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    const { canRead } = await import("@/lib/authorization");
    if (!(await canRead(user, workflow))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const res = okResponse({ ...workflow, nodes: await resolveNodes(workflow.id) });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      evaluation_contract,
      create_new_version,
    } = body;
    const workflowId = Number(id);

    const existing = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [workflowId],
    );
    if (!existing) {
      const res = errorResponse(
        "NOT_FOUND",
        "워크플로를 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const { canEdit } = await import("@/lib/authorization");
    if (!(await canEdit(user, existing))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "편집 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await withTransaction(async (client) => {
      const shouldCreateNewVersion =
        Array.isArray(nodes) && create_new_version === true;

      if (shouldCreateNewVersion) {
        const newVersion = incrementWorkflowVersion(existing.version);
        const evaluationContractValue =
          evaluation_contract === undefined
            ? jsonbParam(existing.evaluation_contract)
            : jsonbParam(evaluation_contract);

        // Publishing a new version: deactivate all prior active versions
        // in the same family, then insert the new row already flagged active.
        // The new row inherits the parent's family_root_id so a single
        // WHERE family_root_id = N finds every version of this workflow.
        await client.query(
          `UPDATE workflows SET is_active = FALSE, updated_at = NOW()
            WHERE family_root_id = $1 AND is_active = TRUE`,
          [existing.family_root_id],
        );

        const { rows: workflowRows } = await client.query(
          `INSERT INTO workflows
             (title, description, version, parent_workflow_id, family_root_id,
              is_active, evaluation_contract, owner_id, folder_id)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8) RETURNING id`,
          [
            (title ?? existing.title).trim(),
            (description ?? existing.description).trim(),
            newVersion,
            workflowId,
            existing.family_root_id,
            evaluationContractValue,
            existing.owner_id,
            existing.folder_id,
          ],
        );
        const newWorkflowId = workflowRows[0].id as number;

        for (let i = 0; i < nodes.length; i++) {
          const node: NodeInput = nodes[i];
          await client.query(
            "INSERT INTO workflow_nodes (workflow_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
              newWorkflowId,
              i + 1,
              (node.node_type ?? "action").trim(),
              (node.title ?? "").trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              node.auto_advance ? 1 : 0,
              node.credential_id ?? null,
            ],
          );
        }

        const { rows } = await client.query(
          "SELECT * FROM workflows WHERE id = $1",
          [newWorkflowId],
        );
        const workflow = rows[0] as Workflow;
        return { ...workflow, nodes: await resolveNodes(newWorkflowId) };
      }

      const versionValue =
        typeof version === "string" && version.trim()
          ? version.trim()
          : undefined;
      const evaluationContractValue =
        evaluation_contract === undefined
          ? jsonbParam(existing.evaluation_contract)
          : jsonbParam(evaluation_contract);

      await client.query(
        "UPDATE workflows SET title = $1, description = $2, version = $3, evaluation_contract = $4, updated_at = NOW() WHERE id = $5",
        [
          (title ?? existing.title).trim(),
          (description ?? existing.description).trim(),
          versionValue ?? existing.version,
          evaluationContractValue,
          workflowId,
        ],
      );

      if (Array.isArray(nodes)) {
        await client.query(
          "DELETE FROM workflow_nodes WHERE workflow_id = $1",
          [workflowId],
        );
        for (let i = 0; i < nodes.length; i++) {
          const node: NodeInput = nodes[i];
          await client.query(
            "INSERT INTO workflow_nodes (workflow_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
              workflowId,
              i + 1,
              (node.node_type ?? "action").trim(),
              (node.title ?? "").trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              node.auto_advance ? 1 : 0,
              node.credential_id ?? null,
            ],
          );
        }
      }

      const { rows } = await client.query(
        "SELECT * FROM workflows WHERE id = $1",
        [workflowId],
      );
      const workflow = rows[0] as Workflow;
      return { ...workflow, nodes: await resolveNodes(workflowId) };
    });

    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:delete",
  async (_request, user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);

    const existing = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [workflowId],
    );

    if (!existing) {
      const res = errorResponse("NOT_FOUND", "워크플로를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const { canDelete } = await import("@/lib/authorization");
    if (!(await canDelete(user, existing))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "삭제 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM workflows WHERE id = $1", [workflowId]);

    const res = okResponse({ id: workflowId, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
