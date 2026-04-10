/**
 * BlueKiwi API Fallback — MCP 미사용 시 REST API로 대체
 *
 * MCP 도구 (mcp__blue-kiwi__*) 사용 불가 시,
 * 동일 기능을 REST API + curl로 수행할 수 있습니다.
 *
 * 사용 방법:
 *   1. API Key 발급: npx tsx scripts/cli.ts apikey create --user-id=1 --name=fallback
 *   2. 환경변수 설정: export BLUEKIWI_API_KEY=bk_xxx
 *   3. 아래 함수들로 curl 명령어 생성
 */

const DEFAULT_BASE_URL = "http://localhost:3000/api";

interface FallbackConfig {
  baseUrl?: string;
  apiKey?: string;
}

function getConfig(cfg?: FallbackConfig) {
  const baseUrl =
    cfg?.baseUrl ?? process.env.BLUEKIWI_API_URL ?? DEFAULT_BASE_URL;
  const apiKey = cfg?.apiKey ?? process.env.BLUEKIWI_API_KEY ?? "";
  const authHeader = apiKey ? `-H "Authorization: Bearer ${apiKey}"` : "";
  return { baseUrl, authHeader };
}

/** MCP list_workflows → GET /api/workflows */
export function curlListWorkflows(cfg?: FallbackConfig): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  return `curl -s ${authHeader} "${baseUrl}/workflows"`;
}

/** MCP start_workflow → POST /api/tasks/start */
export function curlStartWorkflow(
  workflowId: number,
  opts?: { version?: string; context?: string; session_meta?: string },
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = JSON.stringify({
    workflow_id: workflowId,
    ...opts,
  });
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" -d '${body}' "${baseUrl}/tasks/start"`;
}

/** MCP execute_step → POST /api/tasks/:id/execute */
export function curlExecuteStep(
  taskId: number,
  nodeId: number,
  output: string,
  status: "completed" | "failed",
  opts?: {
    context_snapshot?: string;
    structured_output?: {
      user_input?: string;
      thinking?: string;
      assistant_output: string;
    };
  },
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = JSON.stringify({
    node_id: nodeId,
    output,
    status,
    ...opts,
  });
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" -d '${body}' "${baseUrl}/tasks/${taskId}/execute"`;
}

/** MCP advance → POST /api/tasks/:id/advance */
export function curlAdvance(
  taskId: number,
  peek?: boolean,
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = peek ? "-d '{\"peek\":true}'" : "-d '{}'";
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" ${body} "${baseUrl}/tasks/${taskId}/advance"`;
}

/** MCP complete_task → POST /api/tasks/:id/complete */
export function curlCompleteTask(
  taskId: number,
  status: "completed" | "failed",
  summary?: string,
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = JSON.stringify({ status, summary });
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" -d '${body}' "${baseUrl}/tasks/${taskId}/complete"`;
}

/** MCP heartbeat → POST /api/tasks/:id/heartbeat */
export function curlHeartbeat(
  taskId: number,
  nodeId: number,
  progress: string,
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = JSON.stringify({ node_id: nodeId, progress });
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" -d '${body}' "${baseUrl}/tasks/${taskId}/heartbeat"`;
}

/** MCP rewind → POST /api/tasks/:id/rewind */
export function curlRewind(
  taskId: number,
  toStep: number,
  cfg?: FallbackConfig,
): string {
  const { baseUrl, authHeader } = getConfig(cfg);
  const body = JSON.stringify({ to_step: toStep });
  return `curl -s -X POST ${authHeader} -H "Content-Type: application/json" -d '${body}' "${baseUrl}/tasks/${taskId}/rewind"`;
}

/**
 * MCP→REST 매핑 테이블
 *
 * | MCP Tool          | REST Endpoint                  | Method |
 * |-------------------|--------------------------------|--------|
 * | list_workflows    | /api/workflows                 | GET    |
 * | start_workflow    | /api/tasks/start               | POST   |
 * | execute_step      | /api/tasks/:id/execute         | POST   |
 * | advance           | /api/tasks/:id/advance         | POST   |
 * | complete_task     | /api/tasks/:id/complete         | POST   |
 * | heartbeat         | /api/tasks/:id/heartbeat       | POST   |
 * | rewind            | /api/tasks/:id/rewind          | POST   |
 * | get_comments      | /api/tasks/:id/comments        | GET    |
 * | submit_visual     | /api/tasks/:id/execute (visual_html param) | POST |
 * | get_web_response  | /api/tasks/:id/respond         | GET    |
 * | create_workflow   | /api/workflows                 | POST   |
 * | update_workflow   | /api/workflows/:id             | PUT    |
 * | delete_workflow   | /api/workflows/:id             | DELETE |
 * | list_credentials  | /api/credentials               | GET    |
 * | save_artifacts    | (Git operation — CLI only)      | -      |
 * | load_artifacts    | (Git operation — CLI only)      | -      |
 */
export const MCP_REST_MAP = {
  list_workflows: { method: "GET", path: "/api/workflows" },
  start_workflow: { method: "POST", path: "/api/tasks/start" },
  execute_step: { method: "POST", path: "/api/tasks/:id/execute" },
  advance: { method: "POST", path: "/api/tasks/:id/advance" },
  complete_task: { method: "POST", path: "/api/tasks/:id/complete" },
  heartbeat: { method: "POST", path: "/api/tasks/:id/heartbeat" },
  rewind: { method: "POST", path: "/api/tasks/:id/rewind" },
  get_comments: { method: "GET", path: "/api/tasks/:id/comments" },
  submit_visual: { method: "POST", path: "/api/tasks/:id/execute" },
  get_web_response: { method: "GET", path: "/api/tasks/:id/respond" },
  create_workflow: { method: "POST", path: "/api/workflows" },
  update_workflow: { method: "PUT", path: "/api/workflows/:id" },
  delete_workflow: { method: "DELETE", path: "/api/workflows/:id" },
  list_credentials: { method: "GET", path: "/api/credentials" },
} as const;
