import { decodeBoolean, decodeJson, decodeTimestamp } from "../value-codecs";
import { execute, insertAndReturnId, query, queryOne } from "@/lib/db";
import type { Task, TaskLog, Workflow, WorkflowNode } from "@/lib/db";
import { maskSecrets } from "@/lib/db";
import type { User } from "@/lib/auth";
import { canUseCredential } from "@/lib/authorization";
import { notifyTaskUpdate } from "@/lib/notify-ws";

interface TaskRow extends Omit<
  Task,
  "feedback_data" | "target_meta" | "created_at" | "updated_at"
> {
  feedback_data: string | Array<{ question: string; answer: string }> | null;
  target_meta: string | Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface TaskLogRow extends Omit<
  TaskLog,
  | "visual_selection"
  | "structured_output"
  | "created_at"
  | "updated_at"
  | "started_at"
  | "completed_at"
  | "approval_requested_at"
  | "approved_at"
> {
  visual_selection: boolean | number | string | null;
  structured_output: string | null;
  started_at: string | Date;
  completed_at: string | Date | null;
  approval_requested_at: string | Date | null;
  approved_at: string | Date | null;
}

interface WorkflowRow extends Omit<
  Workflow,
  "is_active" | "created_at" | "updated_at"
> {
  is_active: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface WorkflowNodeRow extends Omit<
  WorkflowNode,
  "hitl" | "visual_selection" | "created_at"
> {
  hitl: boolean | number | string;
  visual_selection: boolean | number | string;
  created_at: string | Date;
}

function normalizeTask(row: TaskRow): Task {
  return {
    ...row,
    feedback_data:
      typeof row.feedback_data === "string"
        ? decodeJson<Array<{ question: string; answer: string }>>(
            row.feedback_data,
          )
        : row.feedback_data,
    target_meta:
      typeof row.target_meta === "string"
        ? decodeJson<Record<string, unknown>>(row.target_meta)
        : row.target_meta,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeTaskLog(row: TaskLogRow): TaskLog {
  return {
    ...row,
    visual_selection:
      row.visual_selection == null ? null : decodeBoolean(row.visual_selection),
    structured_output: row.structured_output,
    started_at: decodeTimestamp(row.started_at) ?? new Date(0).toISOString(),
    completed_at: decodeTimestamp(row.completed_at),
    approval_requested_at: decodeTimestamp(row.approval_requested_at),
    approved_at: decodeTimestamp(row.approved_at),
  };
}

function normalizeWorkflow(row: WorkflowRow): Workflow {
  return {
    ...row,
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  return {
    ...row,
    hitl: decodeBoolean(row.hitl),
    visual_selection: decodeBoolean(row.visual_selection),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

export async function findTaskById(taskId: number): Promise<Task | null> {
  const row = await queryOne<TaskRow>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  return row ? normalizeTask(row) : null;
}

export async function findWorkflowByIdForTask(
  workflowId: number,
): Promise<Workflow | null> {
  const row = await queryOne<WorkflowRow>(
    "SELECT * FROM workflows WHERE id = $1",
    [workflowId],
  );
  return row ? normalizeWorkflow(row) : null;
}

export async function loadTaskWithWorkflow(taskId: number): Promise<{
  task: Task | null;
  workflow: Workflow | null;
}> {
  const task = await findTaskById(taskId);
  if (!task) return { task: null, workflow: null };
  const workflow = await findWorkflowByIdForTask(task.workflow_id);
  return { task, workflow };
}

export async function listTasksForVisibilityFilter(input: {
  filterSql: string;
  filterParams: unknown[];
  workflowId?: number;
  status?: string;
  q?: string;
}): Promise<
  Array<
    Task & {
      workflow_title: string | null;
      total_steps: number;
      logs: TaskLog[];
    }
  >
> {
  let sql = `SELECT t.* FROM tasks t
      JOIN workflows w ON w.id = t.workflow_id
      WHERE ${input.filterSql}`;
  const params: unknown[] = [...input.filterParams];

  if (input.workflowId !== undefined) {
    params.push(input.workflowId);
    sql += ` AND t.workflow_id = $${params.length}`;
  }
  if (input.status) {
    params.push(input.status);
    sql += ` AND t.status = $${params.length}`;
  }
  if (input.q) {
    params.push(`%${input.q}%`);
    sql += ` AND t.context LIKE $${params.length}`;
  }

  sql += " ORDER BY t.created_at DESC";

  const rows = await query<TaskRow>(sql, params);
  const tasks = rows.map(normalizeTask);

  return Promise.all(
    tasks.map(async (task) => {
      const logs = await listTaskLogs(task.id);
      const workflow = await queryOne<{
        title: string;
        node_count: string | number;
      }>(
        `SELECT w.title, COUNT(wn.id) AS node_count
         FROM workflows w
         LEFT JOIN workflow_nodes wn ON wn.workflow_id = w.id
         WHERE w.id = $1
         GROUP BY w.id`,
        [task.workflow_id],
      );
      return {
        ...task,
        workflow_title: workflow?.title ?? null,
        total_steps: Number(workflow?.node_count ?? 0),
        logs,
      };
    }),
  );
}

export async function createTaskForWorkflow(
  workflowId: number,
): Promise<Task | null> {
  const taskId = await insertAndReturnId(
    "INSERT INTO tasks (workflow_id, status, current_step) VALUES ($1, 'running', 1)",
    [workflowId],
  );
  return findTaskById(taskId);
}

export async function listTaskLogs(taskId: number): Promise<TaskLog[]> {
  const rows = await query<TaskLogRow>(
    "SELECT * FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
    [taskId],
  );
  return rows.map(normalizeTaskLog);
}

export async function listTaskLogsWithCredentialService(
  taskId: number,
): Promise<Array<TaskLog & { credential_service: string | null }>> {
  const rows = await query<TaskLogRow & { credential_service: string | null }>(
    `SELECT tl.*, wn.visual_selection, wn.hitl, (
       SELECT c.service_name FROM credentials c
       JOIN workflow_nodes cn2 ON cn2.credential_id = c.id
       WHERE cn2.id = tl.node_id
     ) as credential_service
     FROM task_logs tl
     LEFT JOIN workflow_nodes wn ON wn.id = tl.node_id
     WHERE tl.task_id = $1 ORDER BY tl.step_order ASC`,
    [taskId],
  );
  return rows.map((row) => ({
    ...normalizeTaskLog(row),
    credential_service: row.credential_service,
  }));
}

export async function getWorkflowTaskInfo(workflowId: number): Promise<{
  title: string | null;
  node_count: number;
}> {
  const row = await queryOne<{ title: string; node_count: string | number }>(
    `SELECT w.title, COUNT(wn.id) AS node_count
     FROM workflows w
     LEFT JOIN workflow_nodes wn ON wn.workflow_id = w.id
     WHERE w.id = $1
     GROUP BY w.id`,
    [workflowId],
  );
  return {
    title: row?.title ?? null,
    node_count: Number(row?.node_count ?? 0),
  };
}

export async function updateTaskStatus(
  taskId: number,
  status: string,
): Promise<Task | null> {
  await execute("UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3", [
    status,
    new Date().toISOString(),
    taskId,
  ]);
  return findTaskById(taskId);
}

export async function deleteTaskCascade(taskId: number): Promise<void> {
  await execute("DELETE FROM task_logs WHERE task_id = $1", [taskId]);
  await execute("DELETE FROM task_comments WHERE task_id = $1", [taskId]);
  await execute("DELETE FROM tasks WHERE id = $1", [taskId]);
}

export async function findWorkflowNodeByStep(
  workflowId: number,
  stepOrder: number,
): Promise<WorkflowNode | null> {
  const row = await queryOne<WorkflowNodeRow>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2",
    [workflowId, stepOrder],
  );
  return row ? normalizeWorkflowNode(row) : null;
}

export async function findLatestTaskLogForNode(
  taskId: number,
  nodeId: number,
): Promise<Pick<TaskLog, "status" | "approved_at"> | null> {
  const row = await queryOne<Pick<TaskLogRow, "status" | "approved_at">>(
    "SELECT status, approved_at FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
    [taskId, nodeId],
  );
  if (!row) return null;
  return {
    status: row.status,
    approved_at: decodeTimestamp(row.approved_at),
  };
}

export async function findTaskPeekLog(
  taskId: number,
  nodeId: number,
): Promise<TaskLog | null> {
  const row = await queryOne<TaskLogRow>(
    "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
    [taskId, nodeId],
  );
  return row ? normalizeTaskLog(row) : null;
}

export async function listTaskComments(taskId: number, stepOrder: number) {
  return query(
    "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
    [taskId, stepOrder],
  );
}

export async function maybeResumeTimedOutTask(task: Task): Promise<Task> {
  if (task.status !== "timed_out") return task;
  await execute(
    "UPDATE tasks SET status = 'running', updated_at = $2 WHERE id = $1",
    [task.id, new Date().toISOString()],
  );
  void notifyTaskUpdate(task.id, "task_resumed");
  return { ...task, status: "running", updated_at: new Date().toISOString() };
}

export async function completeTaskIfNoNextNode(taskId: number): Promise<void> {
  await execute(
    "UPDATE tasks SET status = 'completed', updated_at = $2 WHERE id = $1",
    [taskId, new Date().toISOString()],
  );
  void notifyTaskUpdate(taskId, "task_completed");
}

export async function cancelTask(taskId: number): Promise<Task | null> {
  await execute(
    "UPDATE tasks SET status = 'cancelled', updated_at = $2 WHERE id = $1",
    [taskId, new Date().toISOString()],
  );
  await execute(
    "UPDATE task_logs SET status = 'cancelled' WHERE task_id = $1 AND status IN ('running', 'pending')",
    [taskId],
  );
  void notifyTaskUpdate(taskId, "task_cancelled");
  return findTaskById(taskId);
}

export async function advanceTaskToStep(input: {
  taskId: number;
  nextNode: WorkflowNode;
}): Promise<void> {
  await execute(
    "UPDATE tasks SET current_step = $1, updated_at = $2 WHERE id = $3",
    [input.nextNode.step_order, new Date().toISOString(), input.taskId],
  );
  void notifyTaskUpdate(input.taskId, "step_advanced", {
    current_step: input.nextNode.step_order,
  });
  await execute(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [
      input.taskId,
      input.nextNode.id,
      input.nextNode.step_order,
      input.nextNode.title,
      input.nextNode.node_type,
    ],
  );
}

export async function rewindTaskToStep(input: {
  task: Task;
  targetNode: WorkflowNode;
  toStep: number;
}): Promise<void> {
  await execute(
    "UPDATE task_logs SET status = 'cancelled', completed_at = $2 WHERE task_id = $1 AND status IN ('pending', 'running')",
    [input.task.id, new Date().toISOString()],
  );
  await execute(
    "UPDATE tasks SET current_step = $1, updated_at = $2 WHERE id = $3",
    [input.toStep, new Date().toISOString(), input.task.id],
  );
  await execute(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [
      input.task.id,
      input.targetNode.id,
      input.toStep,
      input.targetNode.title,
      input.targetNode.node_type,
    ],
  );
}

export async function resolveTaskNodeResponse(node: WorkflowNode, user: User) {
  let instruction = node.instruction;
  if (node.instruction_id) {
    const inst = await queryOne<{ content: string }>(
      "SELECT content FROM instructions WHERE id = $1",
      [node.instruction_id],
    );
    if (inst) instruction = inst.content;
  }

  let credentials = null;
  if (node.credential_id) {
    const cred = await queryOne<{
      id: number;
      owner_id: number;
      service_name: string;
      secrets: string;
    }>(
      "SELECT id, owner_id, service_name, secrets FROM credentials WHERE id = $1",
      [node.credential_id],
    );
    if (cred && (await canUseCredential(user, cred))) {
      credentials = {
        service: cred.service_name,
        secrets_masked: maskSecrets(cred.secrets),
      };
    }
  }

  const attachments = await query<{
    id: number;
    filename: string;
    mime_type: string;
    size_bytes: number;
  }>(
    "SELECT id, filename, mime_type, size_bytes FROM node_attachments WHERE node_id = $1 ORDER BY created_at",
    [node.id],
  );

  return {
    node_id: node.id,
    step_order: node.step_order,
    node_type: node.node_type,
    title: node.title,
    instruction,
    hitl: node.hitl,
    loop_back_to: node.loop_back_to,
    auto_advance: !!node.auto_advance,
    credentials,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export async function getTaskRegistryMap(task: Task, logs: TaskLog[]) {
  const slugs = new Set<string>();
  if (task.provider_slug) slugs.add(task.provider_slug);
  if (task.model_slug) slugs.add(task.model_slug);
  for (const log of logs) {
    if (log.provider_slug) slugs.add(log.provider_slug);
    if (log.model_slug) slugs.add(log.model_slug);
  }

  const registry: Record<string, string> = {};
  if (slugs.size === 0) return registry;

  const slugArr = [...slugs];
  const placeholders = slugArr.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await query<{ slug: string; display_name: string }>(
    `SELECT slug, display_name FROM agent_registry WHERE slug IN (${placeholders})`,
    slugArr,
  );
  for (const row of rows) {
    registry[row.slug] = row.display_name;
  }
  return registry;
}

export async function resolveTaskProvider(
  taskId: number,
): Promise<string | null> {
  const row = await queryOne<{ provider_slug: string | null }>(
    "SELECT provider_slug FROM tasks WHERE id = $1",
    [taskId],
  );
  return row?.provider_slug ?? null;
}

export async function findPendingOrRunningTaskLog(input: {
  taskId: number;
  nodeId: number;
}): Promise<{ id: number; step_order: number } | null> {
  const row = await queryOne<{ id: number; step_order: number }>(
    "SELECT id, step_order FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('running', 'pending') ORDER BY id DESC LIMIT 1",
    [input.taskId, input.nodeId],
  );
  return row ?? null;
}

export async function completeTaskLog(input: {
  logId: number;
  output: string;
  status: string;
  visualHtml: string | null;
  contextSnapshot: string | null;
  structuredOutput: unknown;
  sessionId: string | null;
  providerSlug: string | null;
  userName: string | null;
  modelSlug: string | null;
}): Promise<void> {
  await execute(
    `UPDATE task_logs
     SET output = $1, status = $2, completed_at = $3,
         visual_html = COALESCE($4, visual_html),
         context_snapshot = COALESCE($5, context_snapshot),
         structured_output = COALESCE($6, structured_output),
         session_id = COALESCE($7, session_id),
         provider_slug = COALESCE($8, provider_slug),
         user_name = COALESCE($9, user_name),
         model_slug = COALESCE($10, model_slug)
     WHERE id = $11`,
    [
      input.output,
      input.status,
      new Date().toISOString(),
      input.visualHtml,
      input.contextSnapshot,
      input.structuredOutput ? JSON.stringify(input.structuredOutput) : null,
      input.sessionId,
      input.providerSlug,
      input.userName,
      input.modelSlug,
      input.logId,
    ],
  );
}

export async function upsertAgentRegistrySlug(input: {
  kind: "provider" | "model";
  slug: string;
}): Promise<void> {
  await execute(
    "INSERT INTO agent_registry (kind, slug, display_name) VALUES ($1, $2, $2) ON CONFLICT (kind, slug) DO NOTHING",
    [input.kind, input.slug],
  );
}

export async function mergeTaskRunningContext(input: {
  taskId: number;
  stepOrder: number;
  contextSnapshot: unknown;
}): Promise<void> {
  const task = await queryOne<{ running_context: string | null }>(
    "SELECT running_context FROM tasks WHERE id = $1",
    [input.taskId],
  );
  const existing = task?.running_context
    ? JSON.parse(task.running_context)
    : {};
  const snapshot =
    typeof input.contextSnapshot === "string"
      ? JSON.parse(input.contextSnapshot)
      : input.contextSnapshot;
  const merged = {
    ...existing,
    ...snapshot,
    last_completed_step: input.stepOrder,
    last_updated: new Date().toISOString(),
  };
  await execute(
    "UPDATE tasks SET running_context = $1, updated_at = $2 WHERE id = $3",
    [JSON.stringify(merged), new Date().toISOString(), input.taskId],
  );
}

export async function touchTaskUpdatedAt(taskId: number): Promise<void> {
  await execute("UPDATE tasks SET updated_at = $2 WHERE id = $1", [
    taskId,
    new Date().toISOString(),
  ]);
}

export async function saveTaskArtifacts(input: {
  taskId: number;
  stepOrder: number;
  artifacts: Array<Record<string, unknown>>;
}): Promise<number> {
  let saved = 0;
  for (const art of input.artifacts) {
    await execute(
      "INSERT INTO task_artifacts (task_id, step_order, artifact_type, title, file_path, git_ref, git_branch, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        input.taskId,
        input.stepOrder,
        String(art.artifact_type ?? "file"),
        String(art.title ?? ""),
        art.file_path ?? null,
        art.git_ref ?? null,
        art.git_branch ?? null,
        art.url ?? null,
      ],
    );
    saved += 1;
  }
  return saved;
}

export async function findExecutedNode(nodeId: number): Promise<{
  title: string;
  node_type: string;
  step_order: number;
  loop_back_to: number | null;
  hitl: boolean;
} | null> {
  const row = await queryOne<{
    title: string;
    node_type: string;
    step_order: number;
    loop_back_to: number | null;
    hitl: boolean | number | string;
  }>(
    "SELECT title, node_type, step_order, loop_back_to, hitl FROM workflow_nodes WHERE id = $1",
    [nodeId],
  );
  if (!row) return null;
  return {
    ...row,
    hitl: decodeBoolean(row.hitl),
  };
}

export async function enqueueLoopContinuation(input: {
  taskId: number;
  nodeId: number;
  stepOrder: number;
  title: string;
  nodeType: string;
}): Promise<void> {
  await execute(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [input.taskId, input.nodeId, input.stepOrder, input.title, input.nodeType],
  );
}
