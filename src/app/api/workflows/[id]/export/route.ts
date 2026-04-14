import { NextRequest, NextResponse } from "next/server";
import {
  okResponse,
  query,
  queryOne,
  type Instruction,
  type Workflow,
  type WorkflowNode,
} from "@/lib/db";
import { canRead } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  extractCredentialRequirementFromSecrets,
  parseCredentialRequirement,
  WORKFLOW_PACKAGE_FORMAT,
  WORKFLOW_PACKAGE_VERSION,
  type WorkflowTransferNode,
} from "@/lib/workflow-transfer";

type Params = { params: Promise<{ id: string }> };

function parseJsonOrNull(value: string | null): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);

    const { resource: workflow, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canRead,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "접근 권한 없음",
      });
    if (errResp) return errResp;

    const nodeRows = await query<WorkflowNode>(
      "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY step_order ASC",
      [workflow.id],
    );

    const exportedNodes: WorkflowTransferNode[] = [];
    for (const node of nodeRows) {
      const instructionTemplate = node.instruction_id
        ? await queryOne<Instruction>(
            "SELECT * FROM instructions WHERE id = $1",
            [node.instruction_id],
          )
        : null;

      let credentialRequirement = parseCredentialRequirement(
        node.credential_requirement,
      );
      if (!credentialRequirement && node.credential_id) {
        const credential = await queryOne<{
          service_name: string;
          description: string;
          secrets: string;
        }>(
          "SELECT service_name, description, secrets FROM credentials WHERE id = $1",
          [node.credential_id],
        );
        credentialRequirement = credential
          ? extractCredentialRequirementFromSecrets(
              credential.service_name,
              credential.secrets,
              credential.description,
            )
          : null;
      }

      exportedNodes.push({
        step_order: node.step_order,
        node_type: node.node_type,
        title: node.title,
        instruction: node.instruction,
        loop_back_to: node.loop_back_to,
        auto_advance: Boolean(node.auto_advance),
        hitl: node.hitl,
        visual_selection: node.visual_selection,
        instruction_template: instructionTemplate
          ? {
              title: instructionTemplate.title,
              content: instructionTemplate.content,
              agent_type: instructionTemplate.agent_type,
              tags: instructionTemplate.tags
                ? instructionTemplate.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : [],
              priority: instructionTemplate.priority,
            }
          : null,
        credential_requirement: credentialRequirement,
      });
    }

    const res = okResponse({
      format: WORKFLOW_PACKAGE_FORMAT,
      version: WORKFLOW_PACKAGE_VERSION,
      exported_at: new Date().toISOString(),
      workflow: {
        title: workflow.title,
        description: workflow.description,
        version: workflow.version,
        evaluation_contract: parseJsonOrNull(workflow.evaluation_contract),
        nodes: exportedNodes,
      },
    });

    return NextResponse.json(res.body, {
      status: res.status,
      headers: {
        "Content-Disposition": `attachment; filename="workflow-${workflow.id}.json"`,
      },
    });
  },
);
