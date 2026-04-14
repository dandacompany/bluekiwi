import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  insert,
  Workflow,
  WorkflowNode,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canExecute, canUseCredential } from "@/lib/authorization";
import {
  evaluateCredentialRequirement,
  parseCredentialRequirement,
} from "@/lib/workflow-transfer";

export const POST = withAuth(
  "tasks:execute",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const {
      workflow_id,
      version,
      title,
      context,
      session_meta,
      target,
      provider_slug,
      model_slug,
    } = body;

    if (!workflow_id) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "workflow_id is required",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    if (
      target !== undefined &&
      (typeof target !== "object" || target === null || Array.isArray(target))
    ) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "target는 객체여야 합니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // Resolve workflow. The caller may pass workflow_id directly or pass
    // workflow_id + version to pick a specific version within the same family.
    // Version lookup uses family_root_id (not title) so workflow renames
    // do not break version pinning.
    let workflow: Workflow | undefined;
    if (version) {
      const requested = await queryOne<Workflow>(
        "SELECT * FROM workflows WHERE id = $1",
        [Number(workflow_id)],
      );
      if (!requested) {
        const res = errorResponse(
          "NOT_FOUND",
          "워크플로를 찾을 수 없습니다",
          404,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      workflow = await queryOne<Workflow>(
        "SELECT * FROM workflows WHERE family_root_id = $1 AND version = $2",
        [requested.family_root_id, version],
      );
      if (!workflow) {
        const res = errorResponse(
          "NOT_FOUND",
          `버전 ${version}에 해당하는 워크플로를 찾을 수 없습니다`,
          404,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    } else {
      workflow = await queryOne<Workflow>(
        "SELECT * FROM workflows WHERE id = $1",
        [Number(workflow_id)],
      );
      if (!workflow) {
        const res = errorResponse(
          "NOT_FOUND",
          "워크플로를 찾을 수 없습니다",
          404,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    // Only active versions can be used to start new tasks. Archived versions
    // remain readable (for history/diff UI) but cannot be pinned by a new run.
    if (!workflow.is_active) {
      const res = errorResponse(
        "VERSION_INACTIVE",
        `워크플로 버전 ${workflow.version}은 비활성 상태입니다. 활성 버전을 사용하거나 먼저 활성화하세요.`,
        409,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canExecute(user, workflow))) {
      const res = errorResponse(
        "OWNERSHIP_REQUIRED",
        "이 워크플로에 대한 실행 권한이 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // Verify the caller can use every credential referenced by the workflow's nodes.
    const nodesWithCreds = await query<{
      id: number;
      step_order: number;
      credential_id: number | null;
      credential_requirement: string | null;
      title: string;
    }>(
      "SELECT id, step_order, credential_id, credential_requirement, title FROM workflow_nodes WHERE workflow_id = $1",
      [workflow.id],
    );
    for (const node of nodesWithCreds) {
      const requirement = parseCredentialRequirement(
        node.credential_requirement,
      );
      if (node.credential_id === null) {
        if (requirement) {
          const res = errorResponse(
            "WORKFLOW_CREDENTIAL_SETUP_REQUIRED",
            `노드 "${node.title}" (#${node.step_order})의 크레덴셜 설정이 필요합니다`,
            409,
            {
              step_order: node.step_order,
              service_name: requirement.service_name,
              required_keys: requirement.keys.map((key) => key.name).join(", "),
            },
          );
          return NextResponse.json(res.body, { status: res.status });
        }
        continue;
      }
      const cred = await queryOne<{
        id: number;
        owner_id: number;
        folder_id: number;
        service_name: string;
        secrets: string;
      }>(
        "SELECT id, owner_id, folder_id, service_name, secrets FROM credentials WHERE id = $1",
        [node.credential_id],
      );
      if (!cred) continue;
      if (!(await canUseCredential(user, cred))) {
        const res = errorResponse(
          "CREDENTIAL_USE_DENIED",
          `노드 "${node.title}" (#${node.step_order})의 크레덴셜에 대한 사용 권한이 없습니다`,
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }

      const status = evaluateCredentialRequirement(requirement, cred);
      if (status && status.status !== "ready") {
        const res = errorResponse(
          "WORKFLOW_CREDENTIAL_SETUP_REQUIRED",
          `노드 "${node.title}" (#${node.step_order})의 크레덴셜 설정이 완전하지 않습니다`,
          409,
          {
            step_order: node.step_order,
            service_name: status.service_name,
            required_keys: status.required_keys.join(", "),
            missing_keys: status.missing_keys.join(", "),
            service_mismatch: status.service_mismatch ? "true" : "false",
          },
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    const firstNode = await queryOne<WorkflowNode>(
      "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY step_order ASC LIMIT 1",
      [workflow.id],
    );
    if (!firstNode) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "워크플로에 노드가 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const totalRows = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM workflow_nodes WHERE workflow_id = $1",
      [workflow.id],
    );
    const totalSteps = Number(totalRows?.count ?? 0);

    // Create task
    const taskId = await insert(
      "INSERT INTO tasks (workflow_id, status, current_step, title, context, session_meta, target_meta, provider_slug, model_slug) VALUES ($1, 'running', 1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [
        workflow.id,
        title ? String(title).slice(0, 120) : null,
        context ?? "",
        session_meta ?? "{}",
        target ? JSON.stringify(target) : null,
        provider_slug ?? null,
        model_slug ?? null,
      ],
    );

    // Auto-register provider/model in agent_registry
    if (provider_slug) {
      await execute(
        "INSERT INTO agent_registry (kind, slug, display_name) VALUES ('provider', $1, $1) ON CONFLICT (kind, slug) DO NOTHING",
        [provider_slug],
      );
    }
    if (model_slug) {
      await execute(
        "INSERT INTO agent_registry (kind, slug, display_name) VALUES ('model', $1, $1) ON CONFLICT (kind, slug) DO NOTHING",
        [model_slug],
      );
    }

    // Create first pending log
    await query(
      "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
      [
        taskId,
        firstNode.id,
        firstNode.step_order,
        firstNode.title,
        firstNode.node_type,
      ],
    );

    // Resolve instruction
    let instruction = firstNode.instruction;
    if (firstNode.instruction_id) {
      const inst = await queryOne<{ content: string }>(
        "SELECT content FROM instructions WHERE id = $1",
        [firstNode.instruction_id],
      );
      if (inst) instruction = inst.content;
    }

    // Resolve credential (masked)
    let credentials = null;
    if (firstNode.credential_id) {
      const cred = await queryOne<{
        service_name: string;
        secrets: string;
      }>("SELECT service_name, secrets FROM credentials WHERE id = $1", [
        firstNode.credential_id,
      ]);
      if (cred) {
        credentials = {
          service: cred.service_name,
          secrets_masked: maskSecrets(cred.secrets),
        };
      }
    }

    const res = okResponse(
      {
        task_id: taskId,
        workflow_id: workflow.id,
        workflow_title: workflow.title,
        version: workflow.version,
        evaluation_contract: workflow.evaluation_contract ?? null,
        total_steps: totalSteps,
        current_step: {
          node_id: firstNode.id,
          step_order: firstNode.step_order,
          node_type: firstNode.node_type,
          title: firstNode.title,
          instruction,
          auto_advance: !!firstNode.auto_advance,
          loop_back_to: firstNode.loop_back_to,
          credentials,
        },
      },
      201,
    );
    return NextResponse.json(res.body, { status: res.status });
  },
);
