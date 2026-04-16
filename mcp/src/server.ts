import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { BlueKiwiClient } from "./api-client.js";
import {
  BlueKiwiApiError,
  BlueKiwiAuthError,
  BlueKiwiNetworkError,
} from "./errors.js";
import * as fs from "fs";
import * as path from "path";

type ScanRepoSeverity = "BLOCK" | "REVIEW" | "WARN" | "INFO";

type ScanRepoBuiltinPattern = {
  id: string;
  severity: ScanRepoSeverity;
  source: string;
  flags: string;
  description: string;
  regex: RegExp;
};

const KOREA_OTA_PATTERNS: ScanRepoBuiltinPattern[] = (() => {
  const rrnSource = String.raw`\b\d{6}-?\d{7}\b`;
  const secretSource =
    String.raw`(password|secret|api[_-]?key|token|private[_-]?key)\s*[=:]\s*["'` +
    "`" +
    String.raw`].{8,}`;
  const fieldSource = String.raw`(residentRegistration|rrn|passport|foreignerRegistration|visaNumber|cardNumber|cvv|cvc|accountNumber)`;
  const httpSource = String.raw`http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)`;
  const geoSource = String.raw`navigator\.geolocation\.(getCurrentPosition|watchPosition)`;
  const precheckSource = String.raw`(defaultChecked|checked)\s*=\s*\{?\s*true`;

  return [
    {
      id: "PIPA-001-RRN",
      severity: "REVIEW",
      source: rrnSource,
      flags: "",
      description: "RRN/외국인등록번호 형식",
      regex: new RegExp(rrnSource, ""),
    },
    {
      id: "ISMS-001-SECRET",
      severity: "BLOCK",
      source: secretSource,
      flags: "i",
      description: "하드코딩 시크릿 의심",
      regex: new RegExp(secretSource, "i"),
    },
    {
      id: "PIPA-002-FIELD",
      severity: "REVIEW",
      source: fieldSource,
      flags: "i",
      description: "고위험 식별자 필드명",
      regex: new RegExp(fieldSource, "i"),
    },
    {
      id: "ISMS-004-HTTP",
      severity: "WARN",
      source: httpSource,
      flags: "",
      description: "평문 HTTP URL (외부)",
      regex: new RegExp(httpSource, ""),
    },
    {
      id: "LIA-001-GEO",
      severity: "REVIEW",
      source: geoSource,
      flags: "",
      description: "Geolocation API 사용",
      regex: new RegExp(geoSource, ""),
    },
    {
      id: "PIPA-004-PRECHECK",
      severity: "REVIEW",
      source: precheckSource,
      flags: "",
      description: "사전 체크된 동의 체크박스",
      regex: new RegExp(precheckSource, ""),
    },
  ];
})();

const SCAN_REPO_DEFAULT_GLOBS: string[] = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.java",
  "*.py",
  "*.go",
  "*.rs",
  "*.sql",
  "*.yml",
  "*.yaml",
  "*.properties",
  "*.env",
  "*.tf",
  "*.hcl",
];

const SCAN_REPO_SKIP_DIRS: Set<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
]);

const apiUrl = process.env.BLUEKIWI_API_URL;
const apiKey = process.env.BLUEKIWI_API_KEY ?? parseApiKeyFlag();

if (!apiUrl) {
  throw new Error("BLUEKIWI_API_URL is required");
}

if (!apiKey) {
  throw new Error("BLUEKIWI_API_KEY is required");
}

const client = new BlueKiwiClient(apiUrl, apiKey);
const server = new Server(
  { name: "bluekiwi", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const tools: Tool[] = [
  tool(
    "list_workflows",
    "List workflows visible to the current user. Returns slim metadata by default (id, title, description, version, node titles+types — no instruction content). Pass slim=false to include full node details including instruction text. Pass include_inactive=true to see archived versions. Pass folder_id to filter by folder.",
    {
      include_inactive: { type: "boolean" },
      folder_id: { type: "number" },
      slim: { type: "boolean" },
    },
  ),
  tool(
    "list_tasks",
    "List tasks visible to the current user. Optionally filter by workflow_id, status (running/completed/failed), or search query. Returns task id, workflow_title, status, current_step, total_steps, and logs.",
    {
      workflow_id: { type: "number" },
      status: { type: "string" },
      q: { type: "string" },
    },
  ),
  tool(
    "list_workflow_versions",
    "List every version in the same family as the given workflow id, including active and archived ones. Returns the active_version_id and an ordered versions array.",
    {
      workflow_id: { type: "number" },
    },
    ["workflow_id"],
  ),
  tool(
    "activate_workflow",
    "Activate a specific workflow version. Automatically deactivates the other active version in the same family (one active version per family).",
    {
      workflow_id: { type: "number" },
    },
    ["workflow_id"],
  ),
  tool(
    "deactivate_workflow",
    "Deactivate a specific workflow version. Archived versions remain readable but cannot be pinned by new task starts.",
    {
      workflow_id: { type: "number" },
    },
    ["workflow_id"],
  ),
  tool(
    "start_workflow",
    "Start a task from a workflow id. Optionally pin a specific version within the same family. Starting against an archived (inactive) version fails with HTTP 409. Pass a short `title` (max 60 chars, derived from the user's goal) so the task list shows a meaningful label instead of the raw prompt.",
    {
      workflow_id: { type: "number" },
      version: { type: "string" },
      title: { type: "string" },
      context: { type: "string" },
      session_meta: { type: "string" },
      target: { type: "object" },
    },
    ["workflow_id"],
  ),
  tool(
    "execute_step",
    "Submit the result for the current workflow step. " +
      "IMPORTANT: If the response contains next_action='wait_for_human_approval', " +
      "you MUST call request_approval next and then STOP — do NOT call advance until a human approves. " +
      "If the response error_code is 'STEP_REWOUND' (HTTP 409), the web UI rewound this step — " +
      "immediately call advance(peek=true) to get the new current step and re-execute from there.",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      output: { type: "string" },
      status: { type: "string" },
      visual_html: { type: "string" },
      loop_continue: { type: "boolean" },
      context_snapshot: { type: "object" },
      structured_output: { type: "object" },
      artifacts: { type: "array" },
      session_id: { type: "string" },
      agent_id: { type: "string" },
      user_name: { type: "string" },
      model_id: { type: "string" },
    },
    ["task_id", "node_id", "output", "status"],
  ),
  tool(
    "advance",
    "Advance a task to the next step, or use peek=true to inspect the current step without advancing. " +
      "WARNING: Do NOT call advance if execute_step returned next_action='wait_for_human_approval'. " +
      "In that case, call request_approval and wait. The server will reject advance with 403 until a human approves.",
    {
      task_id: { type: "number" },
      peek: { type: "boolean" },
    },
    ["task_id"],
  ),
  tool(
    "request_approval",
    "Signal that the current step is complete and human approval is needed before proceeding. " +
      "Call this after execute_step returns next_action='wait_for_human_approval'. " +
      "After calling this, stop and wait — do NOT call advance until the human approves.",
    {
      task_id: { type: "number" },
      message: { type: "string" },
    },
    ["task_id"],
  ),
  tool(
    "approve_step",
    "Approve the current HITL step on behalf of the human, unlocking advance. " +
      "ONLY call this when the human explicitly invokes /bk-approve and confirms approval. " +
      "Never call this autonomously — it must be a deliberate human action.",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "heartbeat",
    "Append progress information for a running task step. " +
      "Check the response after every call: " +
      "if 'cancelled' is true, the task was stopped from the web UI — stop all execution immediately. " +
      "If 'rewound' is true, the web UI rewound the current step — stop executing this step, " +
      "call advance(peek=true) to get the new current_step, and re-execute from there.",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      progress: { type: "string" },
    },
    ["task_id", "node_id", "progress"],
  ),
  tool(
    "complete_task",
    "Mark a task as completed or failed",
    {
      task_id: { type: "number" },
      status: { type: "string" },
      summary: { type: "string" },
    },
    ["task_id", "status"],
  ),
  tool(
    "rewind",
    "Rewind a task to a previous step",
    {
      task_id: { type: "number" },
      to_step: { type: "number" },
    },
    ["task_id", "to_step"],
  ),
  tool(
    "get_web_response",
    "Fetch VS response for a task. Without node_id: returns the latest response. With node_id: returns the response history for that node across all loop iterations (web_response only, no visual_html). Useful for tracking how user preferences evolved across iterations.",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "submit_visual",
    "Submit visual HTML for a task step",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      visual_html: { type: "string" },
    },
    ["task_id", "node_id", "visual_html"],
  ),
  tool(
    "set_visual_html",
    `Submit a VS content fragment for a visual_selection=true gate node. Write HTML fragments using bk-* component classes — the frame (CSS, JS, submit button) is added automatically. Do NOT include <html>, <head>, or <body> tags.

DIALOG SIZE DIRECTIVE (optional, add as first line):
<!-- @bk size=sm -->   default (448px) — simple options, checklist
<!-- @bk size=md -->   medium (672px)  — cards, code-compare
<!-- @bk size=lg -->   large (896px)   — pros-cons, ranking, timeline
<!-- @bk size=xl -->   wide (1152px)   — mockups, matrix, side-by-side wireframes
<!-- @bk size=full --> fullscreen (95vw) — dashboard previews, complex layouts
If omitted, defaults to sm. Use xl or full for any content that benefits from horizontal space.

Built-in components (use class names directly):
SELECTION (collect choices):
- bk-options: A/B/C cards. Wrap in .bk-options, each .bk-option with data-value. Optional data-recommended badge. Contains .bk-option-letter + .bk-option-body with h3+p.
- bk-cards: Visual cards. Wrap in .bk-cards, each .bk-card with data-value. Contains .bk-card-image + .bk-card-body.
- bk-checklist: Multi-select. Wrap in .bk-checklist, each .bk-check-item with data-value. Optional data-checked for defaults.
- bk-code-compare: Code selection. Wrap in .bk-code-compare, each .bk-code-option with data-value. Contains .bk-code-label + pre.bk-code.

INPUT (collect values):
- bk-slider: Numeric. data-name, data-min, data-max, data-value, data-unit on .bk-slider. Contains label.
- bk-input: Short text input. data-name, data-label, data-placeholder, optional data-required, and optional data-response-key="comment".
- bk-textarea: Long-form memo field. data-name, data-label, data-placeholder, optional data-required, and optional data-response-key="comment".
- bk-ranking: Drag reorder. Wrap in .bk-ranking, each .bk-rank-item with data-value.
- bk-matrix: 2x2 placement. .bk-matrix with data-x-label, data-y-label. Each .bk-matrix-item with data-value.

OPTION-LEVEL FEEDBACK:
- Any selectable item (.bk-option, .bk-card, .bk-code-option, .bk-mockup-item, .bk-check-item) may add data-requires-comment to force a memo before submit.
- Optional data-comment-name stores that memo into response.fields[data-comment-name].
- Optional data-comment-label and data-comment-placeholder customize the inline memo UI.

DISPLAY (no values):
- bk-split: Side-by-side. Two .bk-split-panel inside .bk-split.
- bk-pros-cons: .bk-pros + .bk-cons inside .bk-pros-cons.
- bk-mockup: .bk-mockup-header + .bk-mockup-body inside .bk-mockup.
- bk-timeline: .bk-timeline-item with data-status="done|current|pending".

Layout: h2 for title, .bk-subtitle, .bk-section for breaks, .bk-label for category.

Response format (JSON via get_web_response):
{selections: ["a"], values: {budget: 70}, ranking: ["security","ux"], matrix: {auth: {x:0.8,y:0.9}}, comment: "Tighten the pricing section", fields: {change_request: "Add rainy-day fallback"}, option_comments: {b: "Keep this option but improve lodging details"}}
Only populated fields are included.`,
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      html: { type: "string" },
    },
    ["task_id", "node_id", "html"],
  ),
  tool(
    "save_artifacts",
    "Save artifacts for a task step",
    {
      task_id: { type: "number" },
      artifacts: { type: "array" },
    },
    ["task_id", "artifacts"],
  ),
  tool(
    "load_artifacts",
    "Load artifacts for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "get_comments",
    "List comments for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool("list_credentials", "List credentials available to the current user"),
  tool(
    "create_credential",
    "Create a new credential set (API key, token, etc.). Credentials must be placed in a private folder; they cannot live in public folders. Defaults to the caller's My Workspace if folder_id is omitted. Pass secrets as a JSON-serialisable object.",
    {
      service_name: { type: "string" },
      description: { type: "string" },
      secrets: { type: "object" },
      folder_id: { type: "number" },
    },
    ["service_name"],
  ),
  tool(
    "update_credential",
    "Update an existing credential. Pass only the fields you want to change. Replacing secrets overwrites the entire secrets object.",
    {
      credential_id: { type: "number" },
      service_name: { type: "string" },
      description: { type: "string" },
      secrets: { type: "object" },
      folder_id: { type: "number" },
    },
    ["credential_id"],
  ),
  tool(
    "delete_credential",
    "Delete a credential. Fails with 409 if any instruction references this credential.",
    {
      credential_id: { type: "number" },
    },
    ["credential_id"],
  ),
  tool(
    "list_instructions",
    "List instruction templates visible to the current user. Optionally filter by folder_id.",
    {
      folder_id: { type: "number" },
    },
  ),
  tool(
    "create_instruction",
    "Create a new instruction template. agent_type defaults to 'general'. priority is an integer (higher = more important). Pass credential_id (from list_credentials) to bind a default credential — when a workflow node references this instruction, the credential is used automatically.",
    {
      title: { type: "string" },
      content: { type: "string" },
      agent_type: { type: "string" },
      tags: { type: "array" },
      priority: { type: "number" },
      credential_id: { type: "number" },
      folder_id: { type: "number" },
    },
    ["title"],
  ),
  tool(
    "update_instruction",
    "Update an existing instruction template. Pass only the fields you want to change. Set is_active=false to soft-disable without deleting. Pass credential_id to bind a default credential (null to unbind).",
    {
      instruction_id: { type: "number" },
      title: { type: "string" },
      content: { type: "string" },
      agent_type: { type: "string" },
      tags: { type: "array" },
      priority: { type: "number" },
      is_active: { type: "boolean" },
      credential_id: { type: "number" },
    },
    ["instruction_id"],
  ),
  tool(
    "delete_instruction",
    "Delete an instruction template. Fails with 409 if any workflow node references this instruction.",
    {
      instruction_id: { type: "number" },
    },
    ["instruction_id"],
  ),
  tool(
    "create_workflow",
    "Create a new workflow. Optionally place it in a specific folder_id (defaults to the caller's My Workspace).",
    {
      title: { type: "string" },
      description: { type: "string" },
      version: { type: "string" },
      parent_workflow_id: { type: "number" },
      evaluation_contract: { type: "object" },
      nodes: { type: "array" },
      folder_id: { type: "number" },
    },
    ["title"],
  ),
  tool(
    "update_workflow",
    "Update an existing workflow",
    {
      workflow_id: { type: "number" },
      title: { type: "string" },
      description: { type: "string" },
      version: { type: "string" },
      evaluation_contract: { type: "object" },
      create_new_version: { type: "boolean" },
      nodes: { type: "array" },
    },
    ["workflow_id"],
  ),
  tool(
    "delete_workflow",
    "Delete a workflow",
    {
      workflow_id: { type: "number" },
    },
    ["workflow_id"],
  ),
  tool(
    "append_node",
    "Append a new node at the end of a workflow. node_type determines auto_advance automatically (action=auto, gate/loop=manual). Use hitl=true for action nodes that require human approval. For loop nodes, set loop_back_to to the target step_order (usually self). For gate nodes, set visual_selection=true for click-based HTML selection UI.",
    {
      workflow_id: { type: "number" },
      title: { type: "string" },
      instruction: { type: "string" },
      node_type: { type: "string" },
      hitl: { type: "boolean" },
      visual_selection: { type: "boolean" },
      loop_back_to: { type: "number" },
      credential_id: { type: "number" },
      instruction_id: { type: "number" },
    },
    ["workflow_id", "title", "node_type"],
  ),
  tool(
    "insert_node",
    "Insert a new node after a specific step_order in a workflow. Nodes after the insertion point are shifted by +1. For loop nodes, set loop_back_to. For gate nodes, set visual_selection=true for click-based selection.",
    {
      workflow_id: { type: "number" },
      after_step: { type: "number" },
      title: { type: "string" },
      instruction: { type: "string" },
      node_type: { type: "string" },
      hitl: { type: "boolean" },
      visual_selection: { type: "boolean" },
      loop_back_to: { type: "number" },
      credential_id: { type: "number" },
      instruction_id: { type: "number" },
    },
    ["workflow_id", "after_step", "title", "node_type"],
  ),
  tool(
    "update_node",
    "Partially update a single node. Only provided fields are changed. If node_type changes, auto_advance is re-enforced automatically.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      title: { type: "string" },
      instruction: { type: "string" },
      node_type: { type: "string" },
      hitl: { type: "boolean" },
      credential_id: { type: "number" },
      instruction_id: { type: "number" },
      loop_back_to: { type: "number" },
    },
    ["workflow_id", "node_id"],
  ),
  tool(
    "remove_node",
    "Delete a single node and reindex step_order for subsequent nodes (all nodes after the deleted one shift by -1).",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
    },
    ["workflow_id", "node_id"],
  ),
  tool(
    "list_attachments",
    "List file attachments for a workflow node. Returns metadata only (id, filename, mime_type, size_bytes).",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
    },
    ["workflow_id", "node_id"],
  ),
  tool(
    "get_attachment",
    "Download attachment content. Returns text content directly for text files. For binary files, returns metadata with binary=true.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      attachment_id: { type: "number" },
    },
    ["workflow_id", "node_id", "attachment_id"],
  ),
  tool(
    "upload_attachment",
    "Upload a text file as an attachment to a workflow node. Text-only — binary uploads must use the web UI. Use this after creating a workflow to attach scripts, reference docs, or config files that agents can download during execution.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      filename: { type: "string" },
      content: { type: "string" },
      mime_type: { type: "string" },
    },
    ["workflow_id", "node_id", "filename", "content"],
  ),
  tool(
    "delete_attachment",
    "Delete an attachment from a workflow node.",
    {
      workflow_id: { type: "number" },
      node_id: { type: "number" },
      attachment_id: { type: "number" },
    },
    ["workflow_id", "node_id", "attachment_id"],
  ),
  tool(
    "save_feedback",
    "Save post-workflow feedback for a completed task. Call this after collecting user survey responses and before calling complete_task. feedback is an array of {question, answer} objects.",
    {
      task_id: { type: "number" },
      feedback: { type: "array" },
    },
    ["task_id", "feedback"],
  ),
  tool(
    "save_findings",
    "Save one or more compliance findings for a task",
    {
      task_id: { type: "number" },
      findings: { type: "array" },
    },
    ["task_id", "findings"],
  ),
  tool(
    "list_findings",
    "List compliance findings for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "list_folders",
    "List folders visible to the current user. Optionally filter by parent_id.",
    {
      parent_id: { type: "number" },
    },
  ),
  tool(
    "create_folder",
    "Create a new folder under an optional parent. Visibility defaults to 'personal'.",
    {
      name: { type: "string" },
      description: { type: "string" },
      parent_id: { type: "number" },
      visibility: { type: "string" },
    },
    ["name"],
  ),
  tool(
    "share_folder",
    "Share a folder with a user group at the given access level (reader or contributor). Owner or admin only.",
    {
      folder_id: { type: "number" },
      group_id: { type: "number" },
      access_level: { type: "string" },
    },
    ["folder_id", "group_id", "access_level"],
  ),
  tool(
    "unshare_folder",
    "Remove a group share from a folder.",
    {
      folder_id: { type: "number" },
      group_id: { type: "number" },
    },
    ["folder_id", "group_id"],
  ),
  tool(
    "update_folder",
    "Rename or change the description of a folder. Cannot rename system folders. Only the owner or an admin can edit.",
    {
      folder_id: { type: "number" },
      name: { type: "string" },
      description: { type: "string" },
    },
    ["folder_id"],
  ),
  tool(
    "delete_folder",
    "Delete an empty folder. Returns an error if the folder contains any workflows, instructions, credentials, or child folders.",
    {
      folder_id: { type: "number" },
    },
    ["folder_id"],
  ),
  tool(
    "move_workflow",
    "Move a workflow into a different folder. Caller must have edit permission on the destination folder.",
    {
      workflow_id: { type: "number" },
      folder_id: { type: "number" },
    },
    ["workflow_id", "folder_id"],
  ),
  tool(
    "move_instruction",
    "Move an instruction into a different folder.",
    {
      instruction_id: { type: "number" },
      folder_id: { type: "number" },
    },
    ["instruction_id", "folder_id"],
  ),
  tool(
    "transfer_workflow",
    "Transfer ownership of a workflow to another user. Owner, admin, or superuser only.",
    {
      workflow_id: { type: "number" },
      new_owner_id: { type: "number" },
    },
    ["workflow_id", "new_owner_id"],
  ),
  tool("list_my_groups", "List user groups the current user belongs to."),
  tool(
    "submit_report",
    "Send a developer feedback report to the BlueKiwi developer (dante@dante-labs.com). " +
      "Use this when the user has experienced a bug, unexpected behavior, or wants to suggest an improvement. " +
      "PII (emails, phone numbers, API keys, file paths) is automatically stripped server-side before sending. " +
      "type: 'bug' | 'feedback' | 'improvement' | 'other'. " +
      "title: short summary (max 200 chars). " +
      "message: the user's description of the issue or suggestion (max 10000 chars). " +
      "context: optional sanitized session context such as workflow name, step number, error text (max 5000 chars).",
    {
      type: { type: "string" },
      title: { type: "string" },
      message: { type: "string" },
      context: { type: "string" },
    },
    ["type", "title", "message"],
  ),
  /*
scan_repo is the single local-execution exception in an otherwise REST-thin MCP wrapper.
The REST backend has no visibility into the agent's filesystem, so delegating static
pattern scans to it is impossible without an upload/clone model. Keeping this step
in-process preserves determinism and reproducibility of compliance scans. All other
tools must stay thin proxies — do not replicate this pattern elsewhere.
  */
  tool(
    "scan_repo",
    "리포지토리의 특정 경로를 정적 패턴(정규식)으로 스캔하여 컴플라이언스 리스크 신호를 찾아 반환합니다. korea-ota-code 룰셋이 내장되어 있으며, custom 패턴도 추가로 전달할 수 있습니다. [로컬 실행 예외: 이 도구는 REST 백엔드를 거치지 않고 에이전트 파일시스템에서 직접 스캔을 수행합니다.]",
    {
      path: { type: "string" },
      rule_set: { type: "string" },
      custom_patterns: { type: "array" },
      include_globs: { type: "array" },
      max_matches: { type: "number" },
      task_id: { type: "number" },
    },
    ["path"],
  ),
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = toArgs(request.params.arguments);

  try {
    switch (name) {
      case "list_workflows": {
        const qs = new URLSearchParams();
        if (args.include_inactive === true) qs.set("include_inactive", "true");
        if (typeof args.folder_id === "number")
          qs.set("folder_id", String(args.folder_id));
        // slim defaults to true — only pass false when explicitly requested
        if (args.slim === false) qs.set("slim", "false");
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return wrap(await client.request("GET", `/api/workflows${suffix}`));
      }
      case "list_tasks": {
        const qs = new URLSearchParams();
        if (typeof args.workflow_id === "number")
          qs.set("workflow_id", String(args.workflow_id));
        if (typeof args.status === "string") qs.set("status", args.status);
        if (typeof args.q === "string") qs.set("q", args.q);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return wrap(await client.request("GET", `/api/tasks${suffix}`));
      }
      case "list_workflow_versions": {
        const workflowId = requireNumberArg(args, "workflow_id");
        return wrap(
          await client.request("GET", `/api/workflows/${workflowId}/versions`),
        );
      }
      case "activate_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        return wrap(
          await client.request("POST", `/api/workflows/${workflowId}/activate`),
        );
      }
      case "deactivate_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        return wrap(
          await client.request(
            "POST",
            `/api/workflows/${workflowId}/deactivate`,
          ),
        );
      }
      case "start_workflow": {
        // Slugs that look like model names (e.g. "claude-sonnet-4-6", "gpt-5.2")
        // Claude Code sends its model name as clientInfo.name, not the CLI tool name.
        const MODEL_NAME_RE =
          /^(claude|gpt|gemini|o\d|llama|mistral|qwen|deepseek)[-/.]/i;
        const clientName = server.getClientVersion()?.name ?? null;
        let providerSlug: string | null = null;
        let modelSlug: string | null = null;
        try {
          const meta = JSON.parse(
            typeof args.session_meta === "string" ? args.session_meta : "{}",
          );
          // session_meta.agent (process-detected tool) takes priority
          providerSlug = (meta.agent as string | undefined) ?? null;
          modelSlug = (meta.model_id as string | undefined) ?? null;
        } catch {}
        // Fallback: classify clientName as provider or model
        if (clientName) {
          if (MODEL_NAME_RE.test(clientName)) {
            // clientName is a model slug → use as model fallback
            if (!modelSlug) modelSlug = clientName;
          } else if (!providerSlug) {
            // clientName looks like a tool name → use as provider fallback
            providerSlug = clientName;
          }
        }
        args.provider_slug = providerSlug;
        args.model_slug = modelSlug;
        const started = await client.request<{
          data?: { task_id?: number; workflow_id?: number };
        }>("POST", "/api/tasks/start", args);
        const startedTaskId = (started as { data?: { task_id?: number } })?.data
          ?.task_id;
        return wrap({
          ...started,
          ...(startedTaskId !== undefined && {
            webui_url: `${apiUrl.replace(/\/$/, "")}/tasks/${startedTaskId}`,
          }),
        });
      }
      case "execute_step": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        // Do NOT auto-inject provider_slug here — execute/route.ts inherits
        // it from the task row so all steps in a task share the same provider.
        // Map model_id → model_slug for backward compat
        if (body.model_id && !body.model_slug) {
          body.model_slug = body.model_id;
        }
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/execute`, body),
        );
      }
      case "advance": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/advance`, body),
        );
      }
      case "request_approval": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request(
            "POST",
            `/api/tasks/${taskId}/request-approval`,
            body,
          ),
        );
      }
      case "approve_step": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/approve`, {}),
        );
      }
      case "heartbeat": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/heartbeat`, body),
        );
      }
      case "complete_task": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/complete`, body),
        );
      }
      case "rewind": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/rewind`, body),
        );
      }
      case "get_web_response": {
        const taskId = requireNumberArg(args, "task_id");
        const nodeId = typeof args.node_id === "number" ? args.node_id : null;
        const url = nodeId
          ? `/api/tasks/${taskId}/respond?node_id=${nodeId}`
          : `/api/tasks/${taskId}/respond`;
        return wrap(await client.request("GET", url));
      }
      case "submit_visual": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/visual`, body),
        );
      }
      case "set_visual_html": {
        const taskId = requireNumberArg(args, "task_id");
        const nodeId = requireNumberArg(args, "node_id");
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/visual`, {
            node_id: nodeId,
            html: args.html,
          }),
        );
      }
      case "save_artifacts": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/artifacts`, body),
        );
      }
      case "load_artifacts": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/artifacts`),
        );
      }
      case "get_comments": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/comments`),
        );
      }
      case "list_credentials":
        return wrap(await client.request("GET", "/api/credentials"));
      case "create_credential":
        return wrap(await client.request("POST", "/api/credentials", args));
      case "update_credential": {
        const credentialId = requireNumberArg(args, "credential_id");
        const body = { ...args };
        delete body.credential_id;
        return wrap(
          await client.request("PUT", `/api/credentials/${credentialId}`, body),
        );
      }
      case "delete_credential": {
        const credentialId = requireNumberArg(args, "credential_id");
        return wrap(
          await client.request("DELETE", `/api/credentials/${credentialId}`),
        );
      }
      case "list_instructions": {
        const qs = new URLSearchParams();
        if (typeof args.folder_id === "number")
          qs.set("folder_id", String(args.folder_id));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return wrap(await client.request("GET", `/api/instructions${suffix}`));
      }
      case "create_instruction":
        return wrap(await client.request("POST", "/api/instructions", args));
      case "update_instruction": {
        const instructionId = requireNumberArg(args, "instruction_id");
        const body = { ...args };
        delete body.instruction_id;
        return wrap(
          await client.request(
            "PUT",
            `/api/instructions/${instructionId}`,
            body,
          ),
        );
      }
      case "delete_instruction": {
        const instructionId = requireNumberArg(args, "instruction_id");
        return wrap(
          await client.request("DELETE", `/api/instructions/${instructionId}`),
        );
      }
      case "create_workflow": {
        const created = await client.request<{ data?: { id?: number } }>(
          "POST",
          "/api/workflows",
          args,
        );
        const createdId = (created as { data?: { id?: number } })?.data?.id;
        let nodeVerification:
          | {
              expected_count: number;
              created_count: number;
              verified_count: number;
              mismatch: boolean;
            }
          | undefined;
        if (
          createdId !== undefined &&
          Array.isArray((args as Record<string, unknown>).nodes)
        ) {
          const expectedCount = (
            (args as Record<string, unknown>).nodes as unknown[]
          ).length;
          const createdCount = Array.isArray(
            (created as { data?: { nodes?: unknown[] } })?.data?.nodes,
          )
            ? ((created as { data?: { nodes?: unknown[] } }).data?.nodes ?? [])
                .length
            : 0;
          const verified = await client.request<{
            data?: { nodes?: unknown[] };
          }>("GET", `/api/workflows/${createdId}`);
          const verifiedCount = Array.isArray(verified?.data?.nodes)
            ? verified.data!.nodes!.length
            : 0;
          nodeVerification = {
            expected_count: expectedCount,
            created_count: createdCount,
            verified_count: verifiedCount,
            mismatch:
              createdCount !== expectedCount || verifiedCount !== expectedCount,
          };
        }
        return wrap({
          ...created,
          ...(createdId !== undefined && {
            webui_url: `${apiUrl.replace(/\/$/, "")}/workflows/${createdId}`,
          }),
          ...(nodeVerification && {
            node_verification: nodeVerification,
          }),
        });
      }
      case "update_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const body = { ...args };
        delete body.workflow_id;
        return wrap(
          await client.request("PUT", `/api/workflows/${workflowId}`, body),
        );
      }
      case "delete_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        return wrap(
          await client.request("DELETE", `/api/workflows/${workflowId}`),
        );
      }
      case "append_node": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const body = { ...args };
        delete body.workflow_id;
        logNodeMutationAudit("append_node.request", {
          workflow_id: workflowId,
          payload: sanitizeNodeMutationPayload(body),
        });
        const beforeNodes = await fetchWorkflowNodeSnapshot(workflowId);
        const appended = await client.request<{ data?: { id?: number } }>(
          "POST",
          `/api/workflows/${workflowId}/nodes`,
          body,
        );
        const afterNodes = await fetchWorkflowNodeSnapshot(workflowId);
        const verification = buildNodeMutationVerification({
          mutation: "append_node",
          beforeNodes,
          afterNodes,
          expectedDelta: 1,
          expectedNodeId:
            (appended as { data?: { id?: number } })?.data?.id ?? null,
        });
        logNodeMutationAudit("append_node.verification", {
          workflow_id: workflowId,
          verification,
        });
        if (verification.mismatch) {
          logNodeMutationAudit("append_node.mismatch", {
            workflow_id: workflowId,
            payload: sanitizeNodeMutationPayload(body),
            verification,
          });
          throw new Error(
            `append_node verification failed for workflow ${workflowId}: ${JSON.stringify(verification)}`,
          );
        }
        return wrap({
          ...appended,
          node_verification: verification,
        });
      }
      case "insert_node": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const afterStep = requireNumberArg(args, "after_step");
        const body = { ...args };
        delete body.workflow_id;
        delete body.after_step;
        logNodeMutationAudit("insert_node.request", {
          workflow_id: workflowId,
          after_step: afterStep,
          payload: sanitizeNodeMutationPayload(body),
        });
        const beforeNodes = await fetchWorkflowNodeSnapshot(workflowId);
        const inserted = await client.request<{ data?: { id?: number } }>(
          "POST",
          `/api/workflows/${workflowId}/nodes?after=${afterStep}`,
          body,
        );
        const afterNodes = await fetchWorkflowNodeSnapshot(workflowId);
        const verification = buildNodeMutationVerification({
          mutation: "insert_node",
          beforeNodes,
          afterNodes,
          expectedDelta: 1,
          expectedNodeId:
            (inserted as { data?: { id?: number } })?.data?.id ?? null,
        });
        logNodeMutationAudit("insert_node.verification", {
          workflow_id: workflowId,
          after_step: afterStep,
          verification,
        });
        if (verification.mismatch) {
          logNodeMutationAudit("insert_node.mismatch", {
            workflow_id: workflowId,
            after_step: afterStep,
            payload: sanitizeNodeMutationPayload(body),
            verification,
          });
          throw new Error(
            `insert_node verification failed for workflow ${workflowId}: ${JSON.stringify(verification)}`,
          );
        }
        return wrap({
          ...inserted,
          node_verification: verification,
        });
      }
      case "update_node": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const body = { ...args };
        delete body.workflow_id;
        delete body.node_id;
        return wrap(
          await client.request(
            "PATCH",
            `/api/workflows/${workflowId}/nodes/${nodeId}`,
            body,
          ),
        );
      }
      case "remove_node": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        return wrap(
          await client.request(
            "DELETE",
            `/api/workflows/${workflowId}/nodes/${nodeId}`,
          ),
        );
      }
      case "list_attachments": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        return wrap(
          await client.request(
            "GET",
            `/api/workflows/${workflowId}/node-items/${nodeId}/attachments`,
          ),
        );
      }
      case "get_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const attachmentId = requireNumberArg(args, "attachment_id");
        const url =
          `${apiUrl.replace(/\/$/, "")}` +
          `/api/workflows/${workflowId}/node-items/${nodeId}/attachments/${attachmentId}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (res.status === 401) {
          throw new BlueKiwiAuthError();
        }
        if (!res.ok) {
          throw new BlueKiwiApiError(
            res.status,
            await res.text().catch(() => ""),
          );
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const text = await res.text();
          return wrap(text ? JSON.parse(text) : null);
        }

        const disposition = res.headers.get("content-disposition") ?? "";
        const filenameMatch =
          /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(
            disposition,
          );
        const filename = decodeURIComponent(
          filenameMatch?.[1] ?? filenameMatch?.[2] ?? "",
        );
        const sizeHeader = res.headers.get("content-length");
        const sizeBytes =
          typeof sizeHeader === "string" ? Number(sizeHeader) : undefined;

        return wrap({
          data: {
            id: attachmentId,
            filename: filename || undefined,
            mime_type: contentType || undefined,
            size_bytes:
              typeof sizeBytes === "number" && Number.isFinite(sizeBytes)
                ? sizeBytes
                : undefined,
            binary: true,
          },
        });
      }
      case "upload_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const filename = requireStringArg(args, "filename");
        const content = requireStringArg(args, "content");
        const mimeType =
          typeof args.mime_type === "string" && args.mime_type.length > 0
            ? args.mime_type
            : "text/plain";

        const blob = new Blob([content], { type: mimeType });
        const formData = new FormData();
        formData.append("file", blob, filename);

        return wrap(
          await client.requestFormData(
            "POST",
            `/api/workflows/${workflowId}/node-items/${nodeId}/attachments`,
            formData,
          ),
        );
      }
      case "delete_attachment": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const nodeId = requireNumberArg(args, "node_id");
        const attachmentId = requireNumberArg(args, "attachment_id");
        return wrap(
          await client.request(
            "DELETE",
            `/api/workflows/${workflowId}/node-items/${nodeId}/attachments/${attachmentId}`,
          ),
        );
      }
      case "save_feedback": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/feedback`, {
            feedback: args.feedback,
          }),
        );
      }
      case "save_findings": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { findings: args.findings };
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/findings`, body),
        );
      }
      case "list_findings": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/findings`),
        );
      }
      /*
scan_repo is the single local-execution exception in an otherwise REST-thin MCP wrapper.
The REST backend has no visibility into the agent's filesystem, so delegating static
pattern scans to it is impossible without an upload/clone model. Keeping this step
in-process preserves determinism and reproducibility of compliance scans. All other
tools must stay thin proxies — do not replicate this pattern elsewhere.
      */
      case "list_folders": {
        const qs = new URLSearchParams();
        if (typeof args.parent_id === "number")
          qs.set("parent_id", String(args.parent_id));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return wrap(await client.request("GET", `/api/folders${suffix}`));
      }
      case "create_folder":
        return wrap(await client.request("POST", "/api/folders", args));
      case "share_folder": {
        const folderId = requireNumberArg(args, "folder_id");
        return wrap(
          await client.request("POST", `/api/folders/${folderId}/shares`, {
            group_id: args.group_id,
            access_level: args.access_level,
          }),
        );
      }
      case "unshare_folder": {
        const folderId = requireNumberArg(args, "folder_id");
        const groupId = requireNumberArg(args, "group_id");
        return wrap(
          await client.request(
            "DELETE",
            `/api/folders/${folderId}/shares/${groupId}`,
          ),
        );
      }
      case "update_folder": {
        const folderId = requireNumberArg(args, "folder_id");
        const body: Record<string, unknown> = {};
        if (typeof args.name === "string") body.name = args.name;
        if (typeof args.description === "string")
          body.description = args.description;
        return wrap(
          await client.request("PUT", `/api/folders/${folderId}`, body),
        );
      }
      case "delete_folder": {
        const folderId = requireNumberArg(args, "folder_id");
        return wrap(await client.request("DELETE", `/api/folders/${folderId}`));
      }
      case "move_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const folderId = requireNumberArg(args, "folder_id");
        return wrap(
          await client.request("PUT", `/api/workflows/${workflowId}`, {
            folder_id: folderId,
          }),
        );
      }
      case "move_instruction": {
        const instructionId = requireNumberArg(args, "instruction_id");
        const folderId = requireNumberArg(args, "folder_id");
        return wrap(
          await client.request("PUT", `/api/instructions/${instructionId}`, {
            folder_id: folderId,
          }),
        );
      }
      case "transfer_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const newOwnerId = requireNumberArg(args, "new_owner_id");
        return wrap(
          await client.request(
            "POST",
            `/api/workflows/${workflowId}/transfer`,
            { new_owner_id: newOwnerId },
          ),
        );
      }
      case "list_my_groups":
        return wrap(await client.request("GET", "/api/auth/me/groups"));
      case "scan_repo":
        return await scanRepoLocal(args);
      case "submit_report":
        return wrap(await client.request("POST", "/api/report", args));
      default:
        return wrapError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof BlueKiwiAuthError) {
      return wrap({
        error: "auth_failed",
        hint: "Run `npx bluekiwi status` to verify your config, or re-authenticate with `npx bluekiwi accept <new-token>`.",
      });
    }

    if (error instanceof BlueKiwiApiError && error.status >= 500) {
      return wrap({
        error: "server_error",
        status: error.status,
        hint: `${apiUrl.replace(/\/$/, "")}/api/health`,
      });
    }

    if (error instanceof BlueKiwiNetworkError) {
      return wrap({
        error: "network_error",
        message: error.message,
      });
    }

    return wrapError(error instanceof Error ? error.message : String(error));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

type InputSchemaProperties = Record<
  string,
  {
    type: string;
  }
>;

function tool(
  name: string,
  description: string,
  properties?: InputSchemaProperties,
  required?: string[],
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

function toArgs(
  args: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return args ?? {};
}

function requireNumberArg(args: Record<string, unknown>, key: string): number {
  const value = args[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${key} must be a number`);
  }

  return value;
}

function requireStringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

function wrap(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function wrapError(message: string) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function logNodeMutationAudit(event: string, data: Record<string, unknown>) {
  const record = {
    ts: new Date().toISOString(),
    scope: "node-mutation-audit",
    event,
    ...data,
  };
  console.error(JSON.stringify(record));
}

function sanitizeNodeMutationPayload(payload: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const allowedKeys = [
    "title",
    "node_type",
    "instruction",
    "instruction_id",
    "credential_id",
    "hitl",
    "visual_selection",
    "loop_back_to",
  ];
  for (const key of allowedKeys) {
    if (key in payload) {
      out[key] = payload[key];
    }
  }
  if (typeof out["instruction"] === "string") {
    out["instruction_preview"] = String(out["instruction"]).slice(0, 160);
    delete out["instruction"];
  }
  return out;
}

type WorkflowNodeSnapshot = {
  id: number;
  step_order: number | null;
  title: string | null;
  node_type: string | null;
};

async function fetchWorkflowNodeSnapshot(
  workflowId: number,
): Promise<WorkflowNodeSnapshot[]> {
  const workflow = await client.request<{
    data?: { nodes?: Array<Record<string, unknown>> };
  }>("GET", `/api/workflows/${workflowId}`);
  const nodes = Array.isArray(workflow?.data?.nodes)
    ? workflow.data!.nodes!
    : [];
  return nodes.map((node) => ({
    id: Number(node["id"]),
    step_order:
      typeof node["step_order"] === "number"
        ? (node["step_order"] as number)
        : null,
    title: typeof node["title"] === "string" ? (node["title"] as string) : null,
    node_type:
      typeof node["node_type"] === "string"
        ? (node["node_type"] as string)
        : null,
  }));
}

function buildNodeMutationVerification(input: {
  mutation: "append_node" | "insert_node";
  beforeNodes: WorkflowNodeSnapshot[];
  afterNodes: WorkflowNodeSnapshot[];
  expectedDelta: number;
  expectedNodeId: number | null;
}) {
  const beforeIds = new Set(input.beforeNodes.map((node) => node.id));
  const addedNodes = input.afterNodes.filter((node) => !beforeIds.has(node.id));
  const expectedCount = input.beforeNodes.length + input.expectedDelta;
  const countDelta = input.afterNodes.length - input.beforeNodes.length;
  const mismatch =
    input.afterNodes.length !== expectedCount ||
    countDelta !== input.expectedDelta ||
    addedNodes.length !== input.expectedDelta ||
    (input.expectedNodeId !== null &&
      !addedNodes.some((node) => node.id === input.expectedNodeId));

  return {
    mutation: input.mutation,
    before_count: input.beforeNodes.length,
    after_count: input.afterNodes.length,
    expected_count: expectedCount,
    delta: countDelta,
    expected_delta: input.expectedDelta,
    expected_node_id: input.expectedNodeId,
    added_node_ids: addedNodes.map((node) => node.id),
    added_nodes: addedNodes.map((node) => ({
      id: node.id,
      step_order: node.step_order,
      title: node.title,
      node_type: node.node_type,
    })),
    mismatch,
  };
}

async function scanRepoLocal(args: Record<string, unknown>) {
  const scanPath = args["path"];
  if (typeof scanPath !== "string" || scanPath.trim().length === 0) {
    return wrapError("path must be a non-empty string");
  }
  if (scanPath.includes("\u0000")) {
    return wrapError("path contains a null byte");
  }

  const rawRuleSet = args["rule_set"];
  let ruleSet: "korea-ota-code" | "none" = "korea-ota-code";
  if (rawRuleSet !== undefined) {
    if (typeof rawRuleSet !== "string") {
      return wrapError("rule_set must be a string");
    }
    if (rawRuleSet !== "korea-ota-code" && rawRuleSet !== "none") {
      return wrapError("rule_set must be 'korea-ota-code' or 'none'");
    }
    ruleSet = rawRuleSet;
  }

  const rawIncludeGlobs = args["include_globs"];
  let includeGlobs: string[] = SCAN_REPO_DEFAULT_GLOBS;
  if (rawIncludeGlobs !== undefined) {
    if (
      !Array.isArray(rawIncludeGlobs) ||
      rawIncludeGlobs.some((glob) => typeof glob !== "string")
    ) {
      return wrapError("include_globs must be an array of strings");
    }
    includeGlobs = rawIncludeGlobs;
  }

  const rawMaxMatches = args["max_matches"];
  let maxMatches = 200;
  if (rawMaxMatches !== undefined) {
    if (
      typeof rawMaxMatches !== "number" ||
      Number.isNaN(rawMaxMatches) ||
      !Number.isFinite(rawMaxMatches)
    ) {
      return wrapError("max_matches must be a number");
    }
    maxMatches = Math.min(1000, Math.max(1, Math.floor(rawMaxMatches)));
  }

  const rawTaskId = args["task_id"];
  let taskId: number | null = null;
  if (rawTaskId !== undefined) {
    if (
      typeof rawTaskId !== "number" ||
      Number.isNaN(rawTaskId) ||
      !Number.isFinite(rawTaskId)
    ) {
      return wrapError("task_id must be a number");
    }
    taskId = rawTaskId;
  }

  const rawCustomPatterns = args["custom_patterns"];
  type CustomPattern = {
    id: string;
    regex: string;
    description?: string;
    severity?: ScanRepoSeverity;
  };
  const customPatterns: CustomPattern[] = [];
  if (rawCustomPatterns !== undefined) {
    if (!Array.isArray(rawCustomPatterns)) {
      return wrapError("custom_patterns must be an array");
    }
    for (const pattern of rawCustomPatterns) {
      if (!pattern || typeof pattern !== "object") {
        return wrapError("custom_patterns entries must be objects");
      }
      const entry = pattern as Record<string, unknown>;
      const id = entry["id"];
      const regex = entry["regex"];
      const description = entry["description"];
      const severity = entry["severity"];
      if (typeof id !== "string" || id.trim().length === 0) {
        return wrapError("custom_patterns entry id must be a non-empty string");
      }
      if (typeof regex !== "string" || regex.length === 0) {
        return wrapError(`custom_patterns entry regex missing for id ${id}`);
      }
      if (description !== undefined && typeof description !== "string") {
        return wrapError(
          `custom_patterns entry description must be a string for id ${id}`,
        );
      }
      if (
        severity !== undefined &&
        severity !== "BLOCK" &&
        severity !== "REVIEW" &&
        severity !== "WARN" &&
        severity !== "INFO"
      ) {
        return wrapError(`custom_patterns entry severity invalid for id ${id}`);
      }
      customPatterns.push({
        id,
        regex,
        description: typeof description === "string" ? description : undefined,
        severity:
          severity === undefined ? undefined : (severity as ScanRepoSeverity),
      });
    }
  }

  const workspaceCwd = path.resolve(process.cwd());
  const resolvedScanPath = path.resolve(workspaceCwd, scanPath);
  if (resolvedScanPath.includes("\u0000")) {
    return wrapError("scan path contains a null byte");
  }
  const workspacePrefix = workspaceCwd.endsWith(path.sep)
    ? workspaceCwd
    : workspaceCwd + path.sep;
  if (
    resolvedScanPath !== workspaceCwd &&
    !resolvedScanPath.startsWith(workspacePrefix)
  ) {
    return wrapError("scan path escapes workspace");
  }

  let scanStat: fs.Stats;
  try {
    scanStat = await fs.promises.stat(resolvedScanPath);
  } catch {
    return wrapError("scan path does not exist");
  }

  type CompiledPattern = {
    id: string;
    severity: ScanRepoSeverity;
    description: string;
    regex: RegExp;
  };

  const compiledPatterns: CompiledPattern[] = [];

  function normalizeFlags(flags: string): string {
    const flagSet = new Set(flags.split("").filter(Boolean));
    flagSet.add("g");
    const ordered = ["g", "i", "m", "s", "u", "y", "d"];
    return ordered.filter((flag) => flagSet.has(flag)).join("");
  }

  if (ruleSet !== "none") {
    for (const pattern of KOREA_OTA_PATTERNS) {
      compiledPatterns.push({
        id: pattern.id,
        severity: pattern.severity,
        description: pattern.description,
        regex: new RegExp(pattern.source, normalizeFlags(pattern.flags)),
      });
    }
  }

  for (const pattern of customPatterns) {
    try {
      compiledPatterns.push({
        id: pattern.id,
        severity: pattern.severity ?? "INFO",
        description: pattern.description ?? "",
        regex: new RegExp(pattern.regex, "g"),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return wrapError(
        `custom pattern failed to compile: ${pattern.id}: ${message}`,
      );
    }
  }

  function toPosixPath(p: string): string {
    return p.split(path.sep).join("/");
  }

  function truncate(text: string, maxLen: number): string {
    return text.length <= maxLen ? text : text.slice(0, maxLen);
  }

  function globToRegExp(glob: string): RegExp {
    function globPartToRegexSource(part: string): string {
      let out = "";
      for (let i = 0; i < part.length; i += 1) {
        const char = part[i];
        if (char === "*") {
          out += "[^/]*";
          continue;
        }
        if (char === "{") {
          const endIndex = part.indexOf("}", i + 1);
          if (endIndex === -1) {
            out += "\\{";
            continue;
          }
          const inner = part.slice(i + 1, endIndex);
          const options = inner.split(",").map((value) => value.trim());
          const optionSources = options.map((option) =>
            globPartToRegexSource(option),
          );
          out += `(?:${optionSources.join("|")})`;
          i = endIndex;
          continue;
        }
        if (/[\\^$+?.()|[\]{}]/.test(char)) {
          out += `\\${char}`;
          continue;
        }
        out += char;
      }
      return out;
    }

    return new RegExp(`^${globPartToRegexSource(glob)}$`);
  }

  const includeMatchers = includeGlobs.map((glob) => ({
    matchBasename: !glob.includes("/"),
    regex: globToRegExp(glob),
  }));

  type Match = {
    rule_id: string;
    severity: string;
    file: string;
    line: number;
    column: number;
    match: string;
    snippet: string;
    description: string;
  };

  const matches: Match[] = [];
  const byRule: Record<string, number> = {};
  const bySeverity: Record<ScanRepoSeverity, number> = {
    BLOCK: 0,
    REVIEW: 0,
    WARN: 0,
    INFO: 0,
  };

  let filesScanned = 0;
  let filesSkipped = 0;
  let truncatedOutput = false;

  function shouldIncludeFile(relativePosixPath: string): boolean {
    if (includeMatchers.length === 0) {
      return true;
    }
    const base = path.posix.basename(relativePosixPath);
    return includeMatchers.some((matcher) =>
      matcher.regex.test(matcher.matchBasename ? base : relativePosixPath),
    );
  }

  async function scanFile(absolutePath: string) {
    if (truncatedOutput) {
      return;
    }

    const relativePath = toPosixPath(path.relative(workspaceCwd, absolutePath));
    if (!shouldIncludeFile(relativePath)) {
      return;
    }

    let fileStat: fs.Stats;
    try {
      fileStat = await fs.promises.stat(absolutePath);
    } catch {
      filesSkipped += 1;
      return;
    }
    if (fileStat.size > 1024 * 1024) {
      filesSkipped += 1;
      return;
    }

    let content: string;
    try {
      content = await fs.promises.readFile(absolutePath, "utf8");
    } catch {
      filesSkipped += 1;
      return;
    }

    filesScanned += 1;

    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (truncatedOutput) {
        break;
      }
      const line = lines[lineIndex];
      for (const pattern of compiledPatterns) {
        if (truncatedOutput) {
          break;
        }
        for (const match of line.matchAll(pattern.regex)) {
          const matchedText = match[0] ?? "";
          const index = match.index ?? 0;

          matches.push({
            rule_id: pattern.id,
            severity: pattern.severity,
            file: relativePath,
            line: lineIndex + 1,
            column: index + 1,
            match: truncate(matchedText, 200),
            snippet: truncate(line, 300),
            description: pattern.description,
          });

          byRule[pattern.id] = (byRule[pattern.id] ?? 0) + 1;
          bySeverity[pattern.severity] += 1;

          if (matches.length >= maxMatches) {
            truncatedOutput = true;
            break;
          }
        }
      }
    }
  }

  async function walkDirectory(directoryPath: string) {
    if (truncatedOutput) {
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(directoryPath, {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncatedOutput) {
        break;
      }
      if (entry.isDirectory()) {
        if (SCAN_REPO_SKIP_DIRS.has(entry.name)) {
          continue;
        }
        await walkDirectory(path.join(directoryPath, entry.name));
        continue;
      }
      if (entry.isFile()) {
        await scanFile(path.join(directoryPath, entry.name));
      }
    }
  }

  if (compiledPatterns.length === 0) {
    return wrap({
      scanned_path: scanStat.isDirectory()
        ? toPosixPath(path.relative(workspaceCwd, resolvedScanPath)) || "."
        : toPosixPath(path.relative(workspaceCwd, resolvedScanPath)),
      rule_set: ruleSet,
      patterns_applied: 0,
      files_scanned: 0,
      files_skipped: 0,
      total_matches: 0,
      truncated: false,
      by_rule: {},
      by_severity: bySeverity,
      matches: [],
      task_id: taskId,
    });
  }

  if (scanStat.isDirectory()) {
    await walkDirectory(resolvedScanPath);
  } else if (scanStat.isFile()) {
    await scanFile(resolvedScanPath);
  } else {
    return wrapError("scan path must be a file or directory");
  }

  const relativeScannedPath = toPosixPath(
    path.relative(workspaceCwd, resolvedScanPath),
  );

  return wrap({
    scanned_path: relativeScannedPath.length === 0 ? "." : relativeScannedPath,
    rule_set: ruleSet,
    patterns_applied: compiledPatterns.length,
    files_scanned: filesScanned,
    files_skipped: filesSkipped,
    total_matches: matches.length,
    truncated: truncatedOutput,
    by_rule: byRule,
    by_severity: bySeverity,
    matches,
    task_id: taskId,
  });
}

function parseApiKeyFlag(): string | undefined {
  const index = process.argv.indexOf("--api-key");
  return index >= 0 ? process.argv[index + 1] : undefined;
}
