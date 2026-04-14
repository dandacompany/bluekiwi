import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  withTransaction,
  okResponse,
  errorResponse,
  type Workflow,
} from "@/lib/db";
import {
  canEditFolder,
  canUseCredential,
  loadFolder,
} from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import { parseWorkflowPackage } from "@/lib/workflow-transfer";

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();

    let pkg;
    try {
      pkg = parseWorkflowPackage(body?.package);
    } catch (error) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        error instanceof Error
          ? error.message
          : "워크플로 JSON을 해석할 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const bindingMap =
      body?.credential_bindings &&
      typeof body.credential_bindings === "object" &&
      !Array.isArray(body.credential_bindings)
        ? (body.credential_bindings as Record<string, number | null>)
        : {};

    let targetFolderId: number;
    if (typeof body.folder_id === "number") {
      const folder = await loadFolder(body.folder_id);
      if (!folder) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, folder))) {
        const res = errorResponse("OWNERSHIP_REQUIRED", "폴더 권한 없음", 403);
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = folder.id;
    } else {
      const myWorkspace = await queryOne<{ id: number }>(
        "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
        [user.id],
      );
      if (!myWorkspace) {
        const res = errorResponse(
          "MY_WORKSPACE_MISSING",
          "My Workspace가 없습니다. 관리자에게 문의하세요",
          500,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = myWorkspace.id;
    }

    const importedTitle =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `${pkg.workflow.title} (Imported)`;
    const evaluationContract =
      pkg.workflow.evaluation_contract === null
        ? null
        : JSON.stringify(pkg.workflow.evaluation_contract);

    try {
      const created = await withTransaction(async (client) => {
        const idRow = await client.query(
          "SELECT nextval(pg_get_serial_sequence('workflows', 'id')) AS id",
        );
        const workflowId = Number(idRow.rows[0].id);

        await client.query(
          `INSERT INTO workflows (
             id, title, description, version, parent_workflow_id,
             evaluation_contract, owner_id, folder_id, family_root_id
           )
           VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $1)`,
          [
            workflowId,
            importedTitle,
            pkg.workflow.description,
            pkg.workflow.version,
            evaluationContract,
            user.id,
            targetFolderId,
          ],
        );

        for (const [index, node] of pkg.workflow.nodes.entries()) {
          let instructionId: number | null = null;
          if (node.instruction_template) {
            const instructionRow = await client.query<{ id: number }>(
              `INSERT INTO instructions (
                 title, content, agent_type, tags, priority, owner_id, folder_id
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                node.instruction_template.title,
                node.instruction_template.content,
                node.instruction_template.agent_type ?? "general",
                (node.instruction_template.tags ?? []).join(","),
                node.instruction_template.priority ?? 0,
                user.id,
                targetFolderId,
              ],
            );
            instructionId = instructionRow.rows[0]?.id ?? null;
          }

          const credentialId =
            typeof bindingMap[String(index)] === "number"
              ? Number(bindingMap[String(index)])
              : null;
          if (credentialId !== null) {
            const credential = await queryOne<{
              id: number;
              owner_id: number;
              folder_id: number;
            }>(
              "SELECT id, owner_id, folder_id FROM credentials WHERE id = $1",
              [credentialId],
            );
            if (!credential || !(await canUseCredential(user, credential))) {
              throw new Error(
                `step ${node.step_order} credential binding is not accessible`,
              );
            }
          }

          await client.query(
            `INSERT INTO workflow_nodes (
               workflow_id, step_order, node_type, title, instruction,
               instruction_id, loop_back_to, auto_advance, credential_id,
               hitl, visual_selection, credential_requirement
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              workflowId,
              node.step_order,
              node.node_type,
              node.title,
              node.instruction_template?.content ?? node.instruction,
              instructionId,
              node.loop_back_to,
              node.node_type === "action"
                ? 1
                : node.node_type === "gate"
                  ? 0
                  : node.auto_advance
                    ? 1
                    : 0,
              credentialId,
              node.hitl,
              node.node_type === "gate" ? node.visual_selection : false,
              node.credential_requirement
                ? JSON.stringify(node.credential_requirement)
                : null,
            ],
          );
        }

        const workflowResult = await client.query<Workflow>(
          "SELECT * FROM workflows WHERE id = $1",
          [workflowId],
        );
        const workflow = workflowResult.rows[0];
        if (!workflow) {
          throw new Error("가져온 워크플로를 확인하지 못했습니다");
        }

        return workflow;
      });

      const res = okResponse(created, 201);
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        error instanceof Error
          ? error.message
          : "워크플로를 가져오지 못했습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
