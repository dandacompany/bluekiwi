import { Pool } from "pg";
import {
  evaluateCredentialRequirement,
  parseCredentialRequirement,
  type CredentialBindingStatus,
  type CredentialRequirement,
} from "./workflow-transfer";
import type { DbTransactionClient } from "./db/adapter";
import { getDatabaseConfig } from "./db/config";
import { decodeBoolean, decodeTimestamp } from "./db/value-codecs";
import { ensureDatabaseBootstrapped } from "./db/bootstrap";
import { postgresAdapter, getPostgresPool } from "./db/adapters/postgres";
import { sqliteAdapter } from "./db/adapters/sqlite";

const databaseConfig = getDatabaseConfig();
const activeAdapter =
  databaseConfig.type === "sqlite" ? sqliteAdapter : postgresAdapter;

export function getPool(): Pool {
  if (databaseConfig.type !== "postgres") {
    throw new Error("getPool() is only available in postgres mode");
  }
  return getPostgresPool();
}

export function getDbAdapter() {
  return activeAdapter;
}

export function getDbDialect() {
  return activeAdapter.dialect;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  await ensureDatabaseBootstrapped();
  const result = await activeAdapter.query<T>(text, params);
  return result.rows;
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
): Promise<{ rowCount: number; lastInsertId?: number }> {
  await ensureDatabaseBootstrapped();
  return activeAdapter.execute(text, params);
}

export async function insert(
  text: string,
  params?: unknown[],
): Promise<number> {
  await ensureDatabaseBootstrapped();
  const result = await activeAdapter.query<{ id?: number }>(text, params);
  const id = result.rows[0]?.id;
  if (typeof id !== "number") {
    throw new Error("insert() expected a numeric id from the database result");
  }
  return id;
}

export async function insertAndReturnId(
  text: string,
  params?: unknown[],
  client?: DbTransactionClient,
): Promise<number> {
  await ensureDatabaseBootstrapped();
  if (activeAdapter.dialect === "postgres") {
    const result = client
      ? await client.query<{ id?: number }>(`${text} RETURNING id`, params)
      : await activeAdapter.query<{ id?: number }>(`${text} RETURNING id`, params);
    const id = result.rows[0]?.id;
    if (typeof id !== "number") {
      throw new Error("insertAndReturnId() expected a numeric id from postgres");
    }
    return id;
  }

  const result = client
    ? await client.execute(text, params)
    : await activeAdapter.execute(text, params);
  if (typeof result.lastInsertId !== "number") {
    throw new Error("insertAndReturnId() expected a numeric lastInsertId from sqlite");
  }
  return result.lastInsertId;
}

export async function withTransaction<T>(
  fn: (client: DbTransactionClient) => Promise<T>,
): Promise<T> {
  await ensureDatabaseBootstrapped();
  return activeAdapter.transaction(fn);
}

// ─── Types ───

export interface Instruction {
  id: number;
  title: string;
  content: string;
  agent_type: string;
  tags: string;
  priority: number;
  is_active: boolean;
  owner_id: number;
  folder_id: number;
  visibility_override: Visibility | null;
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
  visibility_override: Visibility | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowShare {
  workflow_id: number;
  group_id: number;
  access_level: FolderShareLevel;
  created_at: string;
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
  credential_requirement: string | null;
  step_order: number;
  node_type: NodeType;
  title: string;
  instruction: string;
  loop_back_to: number | null;
  auto_advance: boolean;
  hitl: boolean;
  version_note: string | null;
  visual_selection: boolean;
  created_at: string;
}

export interface ResolvedWorkflowNode extends WorkflowNode {
  resolved_instruction: string;
  credential_requirement_parsed: CredentialRequirement | null;
  credential_binding_status: CredentialBindingStatus | null;
}

export interface Task {
  id: number;
  workflow_id: number;
  user_id: number | null;
  status: string;
  current_step: number;
  title: string | null;
  context: string;
  running_context: string;
  session_meta: string;
  provider_slug: string | null;
  model_slug: string | null;
  target_meta: unknown | null;
  summary: string;
  feedback_data: Array<{ question: string; answer: string }> | null;
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
  visual_selection: boolean | null;
  web_response: string | null;
  node_title: string;
  node_type: string;
  context_snapshot: string | null;
  structured_output: string | null; // JSONB as string
  session_id: string | null;
  provider_slug: string | null;
  user_name: string | null;
  model_slug: string | null;
  started_at: string;
  completed_at: string | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  approved_by: number | null;
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

export type Visibility = "personal" | "group" | "public" | "inherit";
export type FolderShareLevel = "reader" | "contributor";
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

function normalizeInstruction(row: Record<string, unknown>): Instruction {
  return {
    ...(row as unknown as Instruction),
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeWorkflow(row: Record<string, unknown>): Workflow {
  return {
    ...(row as unknown as Workflow),
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeFolder(row: Record<string, unknown>): Folder {
  return {
    ...(row as unknown as Folder),
    is_system: decodeBoolean(row.is_system),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeCredential(row: Record<string, unknown>): Credential {
  return {
    ...(row as unknown as Credential),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeWorkflowNode(row: Record<string, unknown>): WorkflowNode {
  return {
    ...(row as unknown as WorkflowNode),
    auto_advance: decodeBoolean(row.auto_advance),
    hitl: decodeBoolean(row.hitl),
    visual_selection: decodeBoolean(row.visual_selection),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeResourceRow<T>(table: string, row: T): T {
  if (!row || typeof row !== 'object') return row;
  const record = row as Record<string, unknown>;
  switch (table) {
    case 'folders':
      return normalizeFolder(record) as T;
    case 'instructions':
      return normalizeInstruction(record) as T;
    case 'workflows':
      return normalizeWorkflow(record) as T;
    case 'credentials':
      return normalizeCredential(record) as T;
    case 'workflow_nodes':
      return normalizeWorkflowNode(record) as T;
    default:
      return row;
  }
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

export interface SlimNode {
  id: number;
  step_order: number;
  title: string;
  node_type: string;
}

/** Lightweight node list — titles and types only, no instruction content. */
export async function resolveNodesSlim(
  workflowId: number,
): Promise<SlimNode[]> {
  return query<SlimNode>(
    "SELECT id, step_order, title, node_type FROM workflow_nodes WHERE workflow_id = $1 ORDER BY step_order ASC",
    [workflowId],
  );
}

export async function resolveNodes(
  workflowId: number,
): Promise<ResolvedWorkflowNode[]> {
  const nodeRows = await query<Record<string, unknown>>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY step_order ASC",
    [workflowId],
  );
  const nodes = nodeRows.map(
    (row) =>
      normalizeResourceRow("workflow_nodes", row) as unknown as WorkflowNode,
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
    const credentialRequirement = parseCredentialRequirement(
      node.credential_requirement,
    );
    let credentialBindingStatus: CredentialBindingStatus | null = null;
    if (credentialRequirement) {
      const credential = node.credential_id
        ? await queryOne<{
            service_name: string;
            secrets: string;
          }>("SELECT service_name, secrets FROM credentials WHERE id = $1", [
            node.credential_id,
          ])
        : null;
      credentialBindingStatus = evaluateCredentialRequirement(
        credentialRequirement,
        credential,
      );
    }

    resolved.push({
      ...node,
      resolved_instruction: instruction,
      credential_requirement_parsed: credentialRequirement,
      credential_binding_status: credentialBindingStatus,
    });
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
