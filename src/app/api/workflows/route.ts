import { NextRequest, NextResponse } from "next/server";
import {
  query,
  withTransaction,
  Workflow,
  resolveNodes,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

export const GET = withOptionalAuth(
  "workflows:read",
  async (request: NextRequest) => {
    const includeInactive =
      new URL(request.url).searchParams.get("include_inactive") === "true";

    const workflows = includeInactive
      ? await query<Workflow>(
          "SELECT * FROM workflows ORDER BY updated_at DESC",
        )
      : await query<Workflow>(
          "SELECT * FROM workflows WHERE is_active = TRUE ORDER BY updated_at DESC",
        );

    const workflowsWithNodes = await Promise.all(
      workflows.map(async (workflow) => ({
        ...workflow,
        nodes: await resolveNodes(workflow.id),
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
  node_type?: string;
  loop_back_to?: number;
  auto_advance?: boolean;
}

export const POST = withOptionalAuth(
  "workflows:create",
  async (request: NextRequest) => {
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

    const created = await withTransaction(async (client) => {
      // Insert with family_root_id = NULL first, then set it to self id so
      // the topmost ancestor of every new workflow is itself by default.
      const { rows: workflowRows } = await client.query(
        `INSERT INTO workflows
           (title, description, version, parent_workflow_id, family_root_id,
            is_active, evaluation_contract)
         VALUES ($1, $2, $3, $4, NULL, TRUE, $5) RETURNING id`,
        [
          title.trim(),
          (description ?? "").trim(),
          versionValue,
          parentWorkflowIdValue,
          evaluationContractValue,
        ],
      );
      const workflowId = workflowRows[0].id as number;
      await client.query(
        "UPDATE workflows SET family_root_id = $1 WHERE id = $1",
        [workflowId],
      );

      if (Array.isArray(nodes)) {
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

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
