import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  withTransaction,
  Workflow,
  resolveNodes,
  resolveNodesSlim,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildResourceVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";

export const GET = withAuth(
  "workflows:read",
  async (request: NextRequest, user) => {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const slim = url.searchParams.get("slim") !== "false"; // default true
    const folderId = url.searchParams.get("folder_id");
    const q = url.searchParams.get("q");

    const filter = await buildResourceVisibilityFilter("w", user, 1);

    const clauses: string[] = [filter.sql];
    const params: unknown[] = [...filter.params];
    if (!includeInactive) clauses.push("w.is_active = TRUE");
    if (folderId) {
      params.push(Number(folderId));
      clauses.push(
        `w.folder_id IN (
          WITH RECURSIVE ftree AS (
            SELECT id FROM folders WHERE id = $${params.length}
            UNION ALL
            SELECT f.id FROM folders f JOIN ftree ON f.parent_id = ftree.id
          )
          SELECT id FROM ftree
        )`,
      );
    }
    if (q) {
      params.push(`%${q}%`);
      clauses.push(`w.title ILIKE $${params.length}`);
    }

    const sql = `SELECT w.* FROM workflows w WHERE ${clauses.join(" AND ")} ORDER BY w.updated_at DESC`;
    const workflows = await query<Workflow>(sql, params);

    const workflowsWithNodes = await Promise.all(
      workflows.map(async (workflow) => ({
        ...workflow,
        nodes: slim
          ? await resolveNodesSlim(workflow.id)
          : await resolveNodes(workflow.id),
      })),
    );

    const res = listResponse(workflowsWithNodes, workflowsWithNodes.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

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

function jsonTextParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      parent_workflow_id,
      evaluation_contract,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const versionValue =
      typeof version === "string" && version.trim() ? version.trim() : "1.0";
    const parentWorkflowIdValue =
      typeof parent_workflow_id === "number" ? parent_workflow_id : null;
    const evaluationContractValue =
      evaluation_contract === undefined || evaluation_contract === null
        ? null
        : typeof evaluation_contract === "string"
          ? evaluation_contract
          : JSON.stringify(evaluation_contract);

    // Resolve target folder: user-provided or default to My Workspace
    let targetFolderId: number;
    if (typeof body.folder_id === "number") {
      const f = await loadFolder(body.folder_id);
      if (!f) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, f))) {
        const res = errorResponse(
          "OWNERSHIP_REQUIRED",
          "폴더 편집 권한 없음",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = f.id;
    } else {
      const mw = await queryOne<{ id: number }>(
        "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
        [user.id],
      );
      if (!mw) {
        const res = errorResponse(
          "MY_WORKSPACE_MISSING",
          "My Workspace가 없습니다. 관리자에게 문의하세요",
          500,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = mw.id;
    }

    const created = await withTransaction(async (client) => {
      // Pre-allocate the id via nextval so family_root_id can point to self
      // inside a single INSERT (the column is NOT NULL so a two-step
      // INSERT-then-UPDATE isn't possible).
      const idRow = await client.query(
        "SELECT nextval(pg_get_serial_sequence('workflows', 'id')) AS id",
      );
      const workflowId = Number(idRow.rows[0].id);
      const inserted = await client.query(
        `INSERT INTO workflows (
           id, title, description, version, parent_workflow_id,
           evaluation_contract, owner_id, folder_id, family_root_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $1)
         RETURNING *`,
        [
          workflowId,
          title.trim(),
          description ?? "",
          versionValue,
          parentWorkflowIdValue,
          evaluationContractValue,
          user.id,
          targetFolderId,
        ],
      );
      void inserted;

      if (Array.isArray(nodes)) {
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
              jsonTextParam(node.credential_requirement),
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

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
