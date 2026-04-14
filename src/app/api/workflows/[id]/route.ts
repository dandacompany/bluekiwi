import { NextRequest, NextResponse } from "next/server";
import {
  execute,
  withTransaction,
  Workflow,
  resolveNodes,
  okResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canDelete,
  canEdit,
  canEditFolder,
  canRead,
  loadFolder,
} from "@/lib/authorization";
import { loadResourceOrFail, withResource } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

interface NodeInput {
  title: string;
  instruction?: string;
  instruction_id?: number;
  credential_id?: number;
  credential_requirement?: unknown;
  hitl?: boolean;
  visual_selection?: boolean;
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

export const GET = withResource<Workflow>({
  permission: "workflows:read",
  table: "workflows",
  check: canRead,
  notFoundMessage: "워크플로를 찾을 수 없습니다",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource: workflow }) => {
    const res = okResponse({
      ...workflow,
      nodes: await resolveNodes(workflow.id),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
});

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

    const { resource: existing, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canEdit,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;

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
            "INSERT INTO workflow_nodes (workflow_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id, hitl, visual_selection, credential_requirement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            [
              newWorkflowId,
              i + 1,
              (node.node_type ?? "action").trim(),
              (node.title ?? "").trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              (node.node_type ?? "action") === "action"
                ? 1
                : node.node_type === "gate"
                  ? 0
                  : node.auto_advance
                    ? 1
                    : 0,
              node.credential_id ?? null,
              node.hitl ?? false,
              node.node_type === "gate"
                ? (node.visual_selection ?? false)
                : false,
              jsonbParam(node.credential_requirement),
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
            "INSERT INTO workflow_nodes (workflow_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id, hitl, visual_selection, credential_requirement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            [
              workflowId,
              i + 1,
              (node.node_type ?? "action").trim(),
              (node.title ?? "").trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              (node.node_type ?? "action") === "action"
                ? 1
                : node.node_type === "gate"
                  ? 0
                  : node.auto_advance
                    ? 1
                    : 0,
              node.credential_id ?? null,
              node.hitl ?? false,
              node.node_type === "gate"
                ? (node.visual_selection ?? false)
                : false,
              jsonbParam(node.credential_requirement),
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

/** PATCH — lightweight field updates (e.g. folder_id move) */
export const PATCH = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const workflowId = Number(id);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canEdit,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    if ("folder_id" in body) {
      const folderId = body.folder_id === null ? null : Number(body.folder_id);
      if (folderId !== null) {
        const targetFolder = await loadFolder(folderId);
        if (!targetFolder) {
          return NextResponse.json(
            {
              error: {
                code: "NOT_FOUND",
                message: "대상 폴더를 찾을 수 없습니다",
              },
            },
            { status: 404 },
          );
        }
        if (!(await canEditFolder(user, targetFolder))) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "대상 폴더에 대한 편집 권한이 없습니다",
              },
            },
            { status: 403 },
          );
        }
      }
      await execute(
        "UPDATE workflows SET folder_id = $1, updated_at = NOW() WHERE id = $2",
        [folderId, workflowId],
      );
    }

    const res = okResponse({ id: workflowId, updated: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withResource<Workflow>({
  permission: "workflows:update",
  table: "workflows",
  check: canDelete,
  notFoundMessage: "워크플로를 찾을 수 없습니다",
  forbiddenMessage: "삭제 권한 없음",
  handler: async ({ resource: existing }) => {
    await execute("DELETE FROM workflows WHERE id = $1", [existing.id]);
    const res = okResponse({ id: existing.id, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
});
