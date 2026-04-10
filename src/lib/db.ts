import { Pool, PoolClient } from "pg";

// ─── Pool 싱글톤 ───

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5433/bluekiwi";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL, max: 20 });
  }
  return pool;
}

// 간편 쿼리 헬퍼
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function execute(
  text: string,
  params?: unknown[],
): Promise<{ rowCount: number }> {
  const result = await getPool().query(text, params);
  return { rowCount: result.rowCount ?? 0 };
}

export async function insert(
  text: string,
  params?: unknown[],
): Promise<number> {
  // PostgreSQL에서 INSERT ... RETURNING id
  const { rows } = await getPool().query(text, params);
  return rows[0]?.id as number;
}

// 트랜잭션 헬퍼
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─── Types ───

export interface Instruction {
  id: number;
  title: string;
  content: string;
  agent_type: string;
  tags: string;
  priority: number;
  is_active: number;
  owner_id: number;
  folder_id: number;
  visibility_override: "personal" | null;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: number;
  title: string;
  description: string;
  version: string;
  parent_workflow_id: number | null;
  family_root_id: number;
  is_active: boolean;
  evaluation_contract: string | null;
  owner_id: number;
  folder_id: number;
  visibility_override: "personal" | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationContract {
  steps?: Record<
    string,
    {
      min_output_length?: number;
      required_sections?: string[];
      require_context_snapshot?: boolean;
      min_source_urls?: number;
    }
  >;
  global?: {
    min_avg_output_length?: number;
    require_all_context_snapshots?: boolean;
  };
  qualitative?: {
    analysis_depth?: "low" | "medium" | "high";
    consistency_check?: boolean;
  };
  auto_improve?: {
    safe_fixes?: boolean;
    structural_changes_require_approval?: boolean;
  };
}

export interface WorkflowEvaluation {
  id: number;
  task_id: number;
  workflow_id: number;
  version: string;
  score_quantitative: number | null;
  score_qualitative: number | null;
  score_total: number | null;
  details: string; // JSONB
  evaluated_at: string;
}

export type NodeType = "action" | "gate" | "loop";

export interface WorkflowNode {
  id: number;
  workflow_id: number;
  instruction_id: number | null;
  credential_id: number | null;
  step_order: number;
  node_type: NodeType;
  title: string;
  instruction: string;
  loop_back_to: number | null;
  auto_advance: number;
  created_at: string;
}

export interface ResolvedWorkflowNode extends WorkflowNode {
  resolved_instruction: string;
}

export interface Task {
  id: number;
  workflow_id: number;
  user_id: number | null;
  status: string;
  current_step: number;
  context: string;
  running_context: string;
  session_meta: string;
  target_meta: unknown | null;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface StructuredOutput {
  user_input?: string;
  thinking?: string;
  assistant_output: string;
}

export interface TaskLog {
  id: number;
  task_id: number;
  node_id: number;
  step_order: number;
  status: string;
  rule_id: string | null;
  severity: string | null;
  output: string;
  visual_html: string | null;
  web_response: string | null;
  node_title: string;
  node_type: string;
  context_snapshot: string | null;
  structured_output: string | null; // JSONB as string
  session_id: string | null;
  agent_id: string | null;
  user_name: string | null;
  model_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface TaskArtifact {
  id: number;
  task_id: number;
  step_order: number;
  artifact_type: string;
  title: string;
  file_path: string | null;
  git_ref: string | null;
  git_branch: string | null;
  url: string | null;
  created_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  step_order: number;
  rule_id: string | null;
  severity: string | null;
  comment: string;
  created_at: string;
}

export interface ComplianceFinding {
  id: number;
  task_id: number;
  step_order: number | null;
  rule_id: string;
  severity: "BLOCK" | "REVIEW" | "WARN" | "INFO";
  summary: string;
  detail: string | null;
  fix: string | null;
  authority: string | null;
  file_path: string | null;
  line_number: number | null;
  source: string | null;
  metadata: unknown | null;
  created_at: string;
}

export interface Credential {
  id: number;
  service_name: string;
  description: string;
  secrets: string;
  owner_id: number;
  folder_id: number;
  created_at: string;
  updated_at: string;
}

export type Visibility = "personal" | "group" | "public";
export type FolderShareLevel = "viewer" | "editor";
export type CredentialShareLevel = "use" | "manage";

export interface Folder {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  parent_id: number | null;
  visibility: Visibility;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderShare {
  folder_id: number;
  group_id: number;
  access_level: FolderShareLevel;
  created_at: string;
}

export interface CredentialShare {
  credential_id: number;
  group_id: number;
  access_level: CredentialShareLevel;
  created_at: string;
}

export function maskSecrets(secretsJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(secretsJson) as Record<string, string>;
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        masked[key] = "****";
      } else if (value.length >= 10) {
        masked[key] = value.slice(0, 6) + "****" + value.slice(-4);
      } else if (value.length > 0) {
        masked[key] = value.slice(0, 2) + "****";
      } else {
        masked[key] = "";
      }
    }
    return masked;
  } catch {
    return {};
  }
}

// ─── Node resolver (async) ───

export async function resolveNodes(
  workflowId: number,
): Promise<ResolvedWorkflowNode[]> {
  const nodes = await query<WorkflowNode>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY step_order ASC",
    [workflowId],
  );

  const resolved: ResolvedWorkflowNode[] = [];
  for (const node of nodes) {
    let instruction = node.instruction;
    if (node.instruction_id) {
      const inst = await queryOne<{ content: string }>(
        "SELECT content FROM instructions WHERE id = $1",
        [node.instruction_id],
      );
      if (inst) instruction = inst.content;
    }
    resolved.push({ ...node, resolved_instruction: instruction });
  }
  return resolved;
}

// ─── Response helpers ───

export function okResponse<T>(data: T, status = 200) {
  return { body: { data }, status };
}

export function listResponse<T>(data: T[], total: number) {
  return { body: { data, total }, status: 200 };
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return {
    body: { error: { code, message, ...(details ? { details } : {}) } },
    status,
  };
}
