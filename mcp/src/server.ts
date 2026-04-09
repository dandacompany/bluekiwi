import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Pool } from "pg";
import { execFile } from "child_process";
import { promisify } from "util";
import http from "http";
import * as crypto from "crypto";

const execFileAsync = promisify(execFile);

// ─── WS Relay 알림 ───

const WS_RELAY_URL = "http://localhost:3001/notify";

function notifyRelay(payload: {
  type: string;
  task_id: number;
  event: string;
  data?: unknown;
}) {
  const body = JSON.stringify(payload);
  const url = new URL(WS_RELAY_URL);
  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    () => {}, // 응답 무시 (fire-and-forget)
  );
  req.on("error", () => {}); // relay가 꺼져있어도 에러 무시
  req.write(body);
  req.end();
}

// ─── DB 접근 ───

const DATABASE_URL =
  process.env.DATABASE_URL ??
  ((): string => {
    const dbArg = process.argv.find((a) => a.startsWith("--db-url="));
    return dbArg
      ? dbArg.split("=").slice(1).join("=")
      : "postgresql://omegarod:omegarod_dev_2026@localhost:5432/omegarod";
  })();

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

let authenticatedUser: { id: number; username: string; role: string } | null =
  null;

function getStartupApiKey(): string | null {
  const argWithEquals = process.argv.find((a) => a.startsWith("--api-key="));
  if (argWithEquals) {
    return argWithEquals.slice("--api-key=".length);
  }

  const argIndex = process.argv.findIndex((a) => a === "--api-key");
  if (argIndex !== -1) {
    const next = process.argv[argIndex + 1];
    if (next) return next;
  }

  return process.env.OMEGAROD_API_KEY ?? null;
}

async function validateStartupApiKey() {
  const apiKey = getStartupApiKey();
  if (!apiKey) return;

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  let apiKeyRow:
    | (Record<string, unknown> & {
        id: number;
        user_id: number;
        username: string;
        role: string;
        expires_at?: string | Date | null;
      })
    | undefined;

  try {
    const { rows } = await pool.query(
      `SELECT ak.*, u.username, u.role
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = $1
         AND ak.is_revoked = false
         AND u.is_active = true`,
      [keyHash],
    );
    apiKeyRow = rows[0];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`API key validation failed: ${message}`);
    process.exit(1);
  }

  if (!apiKeyRow) {
    console.error("Invalid API key (not found or revoked).");
    process.exit(1);
  }

  const rawExpiresAt = apiKeyRow.expires_at;
  if (rawExpiresAt) {
    const expiresAt =
      rawExpiresAt instanceof Date ? rawExpiresAt : new Date(rawExpiresAt);
    if (
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= Date.now()
    ) {
      console.error("API key is expired.");
      process.exit(1);
    }
  }

  authenticatedUser = {
    id: apiKeyRow.user_id,
    username: apiKeyRow.username,
    role: apiKeyRow.role,
  };

  try {
    await pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [
      apiKeyRow.id,
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Warning: failed to update api_keys.last_used_at: ${message}`,
    );
  }
}

// ─── Interfaces ───

interface Chain {
  id: number;
  title: string;
  description: string;
  version: string;
  parent_chain_id: number | null;
  evaluation_contract: unknown;
}

interface ChainNode {
  id: number;
  chain_id: number;
  instruction_id: number | null;
  step_order: number;
  node_type: string;
  title: string;
  instruction: string;
  credential_id: number | null;
  loop_back_to: number | null;
  auto_advance: number;
}

interface Task {
  id: number;
  chain_id: number;
  status: string;
  current_step: number;
  context: string;
  running_context: string;
  session_meta: string;
  summary: string;
}

interface TaskLog {
  id: number;
  task_id: number;
  node_id: number;
  step_order: number;
  status: string;
  output: string;
  visual_html: string | null;
  web_response: string | null;
  node_title: string;
  node_type: string;
  context_snapshot: string | null;
  structured_output: StructuredOutput | null;
  session_id: string | null;
  agent_id: string | null;
  user_name: string | null;
  model_id: string | null;
  started_at: string;
  completed_at: string | null;
}

interface StructuredOutput {
  user_input?: string;
  thinking?: string;
  assistant_output: string;
}

interface TaskArtifact {
  id: number;
  task_id: number;
  step_order: number;
  artifact_type: string;
  title: string;
  file_path: string | null;
  git_ref: string | null;
  git_branch: string | null;
  url: string | null;
}

async function resolveInstruction(node: ChainNode): Promise<string> {
  if (node.instruction_id) {
    const { rows } = await pool.query(
      "SELECT content FROM instructions WHERE id = $1",
      [node.instruction_id],
    );
    if (rows[0]) return rows[0].content;
  }
  return node.instruction;
}

async function resolveCredential(node: ChainNode): Promise<{
  service: string;
  title: string;
  secrets: Record<string, string>;
} | null> {
  if (!node.credential_id) return null;
  const { rows } = await pool.query(
    "SELECT service_name, title, secrets FROM credentials WHERE id = $1",
    [node.credential_id],
  );
  if (!rows[0]) return null;
  return {
    service: rows[0].service_name,
    title: rows[0].title,
    secrets: JSON.parse(rows[0].secrets),
  };
}

function maskSecrets(secretsJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(secretsJson) as Record<string, string>;
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") masked[key] = "****";
      else if (value.length >= 10)
        masked[key] = value.slice(0, 6) + "****" + value.slice(-4);
      else if (value.length > 0) masked[key] = value.slice(0, 2) + "****";
      else masked[key] = "";
    }
    return masked;
  } catch {
    return {};
  }
}

const evaluationContractSchema = z
  .record(z.string(), z.unknown())
  .describe("워크플로 평가 계약(JSON 객체)");

const structuredOutputSchema = z.object({
  user_input: z.string().optional(),
  thinking: z.string().optional(),
  assistant_output: z.string(),
});

// ─── Helpers ───

function errorResult(message: string) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
    isError: true,
  };
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function serializeJsonb(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

function extractVersionNumber(segment: string): number | null {
  const exact = Number(segment);
  if (!Number.isNaN(exact)) {
    return exact;
  }

  const matched = segment.match(/\d+/);
  return matched ? Number(matched[0]) : null;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".");
  const bParts = b.split(".");
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? "0";
    const bPart = bParts[index] ?? "0";
    const aNumber = extractVersionNumber(aPart);
    const bNumber = extractVersionNumber(bPart);

    if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    if ((aNumber === null || bNumber === null) && aPart !== bPart) {
      return aPart.localeCompare(bPart, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
  }

  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getLatestChain(chains: Chain[]): Chain | undefined {
  return [...chains].sort((a, b) => compareVersions(b.version, a.version))[0];
}

function incrementVersion(version: string): string {
  const parts = version.split(".");

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    const matched = part.match(/\d+/);

    if (!matched || matched.index === undefined) {
      continue;
    }

    const nextNumber = String(Number(matched[0]) + 1);
    parts[index] =
      part.slice(0, matched.index) +
      nextNumber +
      part.slice(matched.index + matched[0].length);

    return parts.join(".");
  }

  return `${version}.1`;
}

// ─── MCP 서버 ───

const server = new McpServer({
  name: "omega-rod",
  version: "2.0.0",
});

// 1. list_chains — 실행 가능한 체인 목록
server.tool(
  "list_chains",
  "실행 가능한 체인(워크플로) 목록을 조회합니다.",
  {},
  async () => {
    const { rows: chains } = await pool.query<Chain>(
      "SELECT id, title, description, version, parent_chain_id, evaluation_contract FROM chains ORDER BY updated_at DESC",
    );

    const result = [];
    for (const chain of chains) {
      const { rows: nodes } = await pool.query<{
        id: number;
        step_order: number;
        title: string;
      }>(
        "SELECT id, step_order, title FROM chain_nodes WHERE chain_id = $1 ORDER BY step_order ASC",
        [chain.id],
      );
      result.push({
        id: chain.id,
        title: chain.title,
        description: chain.description,
        version: chain.version,
        evaluation_contract: chain.evaluation_contract,
        total_steps: nodes.length,
        steps: nodes.map((n) => `${n.step_order}. ${n.title}`),
      });
    }

    return jsonResult(result);
  },
);

// 2. start_chain — 태스크 생성 + 첫 번째 노드를 pending 상태로 반환
server.tool(
  "start_chain",
  "체인 실행을 시작합니다. 태스크를 생성하고 첫 번째 단계의 지침을 반환합니다 (pending 상태).",
  {
    chain_id: z.number().describe("실행할 체인 ID"),
    version: z
      .string()
      .optional()
      .describe("특정 버전을 실행할 경우 지정 (예: 1.1)"),
    context: z.string().optional().describe("태스크 실행 컨텍스트 (선택)"),
    session_meta: z
      .string()
      .optional()
      .describe(
        "세션 메타 정보 (JSON). project_dir, user_name, agent, git_remote, git_branch 등.",
      ),
  },
  async ({ chain_id, version, context, session_meta }) => {
    const { rows: requestedChainRows } = await pool.query<Chain>(
      "SELECT id, title, description, version, parent_chain_id, evaluation_contract FROM chains WHERE id = $1",
      [chain_id],
    );
    const requestedChain = requestedChainRows[0];
    if (!requestedChain) return errorResult("체인을 찾을 수 없습니다");

    const { rows: familyRows } = await pool.query<Chain>(
      "SELECT id, title, description, version, parent_chain_id, evaluation_contract FROM chains WHERE title = $1",
      [requestedChain.title],
    );

    const chain = version
      ? familyRows.find((candidate) => candidate.version === version)
      : getLatestChain(familyRows);

    if (!chain) {
      return errorResult(
        version
          ? `버전 ${version}에 해당하는 체인을 찾을 수 없습니다`
          : "실행할 체인을 찾을 수 없습니다",
      );
    }

    const { rows: firstNodeRows } = await pool.query(
      "SELECT * FROM chain_nodes WHERE chain_id = $1 ORDER BY step_order ASC LIMIT 1",
      [chain.id],
    );
    const firstNode = firstNodeRows[0] as ChainNode | undefined;
    if (!firstNode) return errorResult("체인에 노드가 없습니다");

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) as count FROM chain_nodes WHERE chain_id = $1",
      [chain.id],
    );
    const totalSteps = countRows[0] as { count: string };

    // 태스크 생성 (context + session_meta 포함)
    const baseTaskValues: Array<number | string> = [
      chain.id,
      context ?? "",
      session_meta ?? "{}",
    ];
    const taskInsertQuery = authenticatedUser
      ? "INSERT INTO tasks (chain_id, status, current_step, context, session_meta, user_id) VALUES ($1, 'running', 1, $2, $3, $4) RETURNING id"
      : "INSERT INTO tasks (chain_id, status, current_step, context, session_meta) VALUES ($1, 'running', 1, $2, $3) RETURNING id";
    const taskInsertValues = authenticatedUser
      ? [...baseTaskValues, authenticatedUser.id]
      : baseTaskValues;
    const { rows: insertedTask } = await pool.query(
      taskInsertQuery,
      taskInsertValues,
    );
    const taskId = insertedTask[0].id as number;

    // 첫 번째 스텝 로그를 pending 상태로 생성 (실행 전)
    await pool.query(
      "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
      [
        taskId,
        firstNode.id,
        firstNode.step_order,
        firstNode.title,
        firstNode.node_type,
      ],
    );

    notifyRelay({
      type: "task_update",
      task_id: taskId,
      event: "started",
      data: {
        chain_title: chain.title,
        chain_version: chain.version,
        step: 1,
        total: Number(totalSteps.count),
      },
    });

    return jsonResult({
      task_id: taskId,
      chain_id: chain.id,
      chain_title: chain.title,
      version: chain.version,
      evaluation_contract: chain.evaluation_contract,
      total_steps: Number(totalSteps.count),
      current_step: {
        node_id: firstNode.id,
        step_order: firstNode.step_order,
        node_type: firstNode.node_type,
        title: firstNode.title,
        instruction: await resolveInstruction(firstNode),
        auto_advance: !!firstNode.auto_advance,
        loop_back_to: firstNode.loop_back_to,
        credentials: await resolveCredential(firstNode),
      },
    });
  },
);

// 3. execute_step — 현재 노드 실행 완료 처리
server.tool(
  "execute_step",
  "현재 노드의 실행을 완료 처리합니다. output과 status를 저장하고, loop 노드에서 반복 여부를 제어합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    node_id: z.number().describe("현재 노드 ID"),
    output: z.string().describe("실행 결과 출력"),
    status: z.enum(["completed", "failed"]).describe("실행 상태"),
    visual_html: z.string().optional().describe("HTML 아티팩트 (선택)"),
    loop_continue: z
      .boolean()
      .optional()
      .describe("loop 노드에서 반복 계속 여부 (선택)"),
    context_snapshot: z
      .string()
      .optional()
      .describe(
        "구조화된 컨텍스트 스냅샷 (JSON). 결정사항, 주요 발견, 다음 단계 힌트 등 세션 복원용 데이터.",
      ),
    structured_output: structuredOutputSchema
      .optional()
      .describe("구조화된 출력 결과 (선택)"),
    artifacts: z
      .array(
        z.object({
          artifact_type: z
            .enum(["file", "git_commit", "url"])
            .describe("아티팩트 타입"),
          title: z.string().describe("아티팩트 제목"),
          file_path: z.string().optional().describe("파일 경로"),
          git_ref: z.string().optional().describe("커밋 해시"),
          git_branch: z.string().optional().describe("Git 브랜치명"),
          url: z.string().optional().describe("URL"),
        }),
      )
      .optional()
      .describe("이 단계에서 생성된 산출물 목록"),
    session_id: z.string().optional().describe("Claude 세션 ID (세션 추적용)"),
    agent_id: z
      .string()
      .optional()
      .describe("에이전트 모델 ID (claude-opus-4, gpt-5.2 등)"),
    user_name: z.string().optional().describe("실행한 사용자 이름"),
    model_id: z
      .string()
      .optional()
      .describe("이 스텝에서 사용한 LLM 모델 ID (claude-opus-4-6, gpt-5.2 등)"),
  },
  async ({
    task_id,
    node_id,
    output,
    status,
    visual_html,
    loop_continue,
    context_snapshot,
    structured_output,
    artifacts,
    session_id,
    agent_id,
    user_name,
    model_id,
  }) => {
    const resolvedUserName =
      user_name !== undefined ? user_name : authenticatedUser?.username;

    // running 또는 pending 상태의 로그 찾기
    const { rows: logRows } = await pool.query(
      "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('running', 'pending') ORDER BY id DESC LIMIT 1",
      [task_id, node_id],
    );
    const log = logRows[0] as TaskLog | undefined;

    if (!log) {
      return errorResult(
        `task_id=${task_id}, node_id=${node_id}에 대한 실행 중인 로그를 찾을 수 없습니다`,
      );
    }

    // 로그 업데이트 (모든 새 필드 포함)
    await pool.query(
      `UPDATE task_logs
       SET output = $1, status = $2, completed_at = NOW(),
           visual_html = COALESCE($3, visual_html),
           context_snapshot = COALESCE($4, context_snapshot),
           structured_output = COALESCE($5::jsonb, structured_output),
           session_id = COALESCE($6, session_id),
           agent_id = COALESCE($7, agent_id),
           user_name = COALESCE($8, user_name),
           model_id = COALESCE($9, model_id)
       WHERE id = $10`,
      [
        output,
        status,
        visual_html ?? null,
        context_snapshot ?? null,
        serializeJsonb(structured_output),
        session_id ?? null,
        agent_id ?? null,
        resolvedUserName ?? null,
        model_id ?? null,
        log.id,
      ],
    );

    // running_context 업데이트 (context_snapshot이 있으면)
    if (context_snapshot) {
      const { rows: taskRows } = await pool.query(
        "SELECT running_context FROM tasks WHERE id = $1",
        [task_id],
      );
      const task = taskRows[0] as { running_context: string } | undefined;
      const existing = task ? JSON.parse(task.running_context || "{}") : {};
      const snapshot = JSON.parse(context_snapshot);

      // 기존 running_context에 새 스냅샷 병합
      const merged = {
        ...existing,
        ...snapshot,
        last_completed_step: log.step_order,
        last_updated: new Date().toISOString(),
      };

      await pool.query(
        "UPDATE tasks SET running_context = $1, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(merged), task_id],
      );
    } else {
      await pool.query("UPDATE tasks SET updated_at = NOW() WHERE id = $1", [
        task_id,
      ]);
    }

    // 아티팩트 저장
    if (artifacts && artifacts.length > 0) {
      for (const art of artifacts) {
        await pool.query(
          "INSERT INTO task_artifacts (task_id, step_order, artifact_type, title, file_path, git_ref, git_branch, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [
            task_id,
            log.step_order,
            art.artifact_type,
            art.title,
            art.file_path ?? null,
            art.git_ref ?? null,
            art.git_branch ?? null,
            art.url ?? null,
          ],
        );
      }
    }

    // loop_continue가 true이면 같은 노드의 새 pending 로그 생성
    if (loop_continue) {
      const { rows: nodeRows } = await pool.query(
        "SELECT * FROM chain_nodes WHERE id = $1",
        [node_id],
      );
      const node = nodeRows[0] as ChainNode | undefined;
      if (node) {
        await pool.query(
          "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
          [task_id, node_id, node.step_order, node.title, node.node_type],
        );
      }
    }

    notifyRelay({
      type: "task_update",
      task_id,
      event: "step_executed",
      data: { node_id, status, loop_continue: !!loop_continue },
    });

    return jsonResult({
      success: true,
      task_id,
      node_id,
      status,
      loop_continue: !!loop_continue,
      artifacts_saved: artifacts?.length ?? 0,
    });
  },
);

// ─── Task Context Builder (세션 복원용) ───

async function buildTaskContext(task: Task) {
  // 완료된 단계 요약
  const { rows: completedLogs } = await pool.query(
    `SELECT tl.step_order, tl.node_title, tl.output, tl.context_snapshot,
            tl.structured_output,
            tl.session_id, tl.agent_id, tl.user_name, tl.model_id,
            tl.started_at, tl.completed_at
     FROM task_logs tl
     WHERE tl.task_id = $1 AND tl.status = 'completed'
     ORDER BY tl.step_order ASC, tl.id ASC`,
    [task.id],
  );

  // 단계별로 그룹핑 (loop 노드는 여러 로그 가능)하고 마지막 output에서 요약 추출
  const stepMap = new Map<
    number,
    {
      title: string;
      outcome: string;
      user_name: string | null;
      model_id: string | null;
      duration_sec: number | null;
      structured_output: StructuredOutput | null;
    }
  >();
  for (const log of completedLogs) {
    const outcome =
      log.output.length > 200
        ? log.output.substring(0, 200) + "..."
        : log.output;
    // 실행 시간 계산
    let duration_sec: number | null = null;
    if (log.started_at && log.completed_at) {
      const start = new Date(log.started_at).getTime();
      const end = new Date(log.completed_at).getTime();
      duration_sec = Math.round((end - start) / 1000);
    }
    stepMap.set(log.step_order, {
      title: log.node_title,
      outcome,
      user_name: log.user_name,
      model_id: log.model_id,
      duration_sec,
      structured_output: log.structured_output,
    });
  }

  const completed_steps = Array.from(stepMap.entries()).map(([step, data]) => ({
    step,
    title: data.title,
    outcome: data.outcome,
    user_name: data.user_name,
    model_id: data.model_id,
    duration_sec: data.duration_sec,
    ...(data.structured_output
      ? { structured_output: data.structured_output }
      : {}),
  }));

  // 아티팩트 목록
  const { rows: artifacts } = await pool.query<TaskArtifact>(
    "SELECT step_order, artifact_type, title, file_path, git_ref, git_branch, url FROM task_artifacts WHERE task_id = $1 ORDER BY step_order ASC",
    [task.id],
  );

  // 워크플로 제목
  const { rows: chainRows } = await pool.query(
    "SELECT title FROM chains WHERE id = $1",
    [task.chain_id],
  );
  const chain = chainRows[0] as { title: string } | undefined;

  // 마지막 세션 정보
  const lastLog = completedLogs[completedLogs.length - 1];

  return {
    task_id: task.id,
    workflow_title: chain?.title ?? "",
    initial_context: task.context,
    running_context: JSON.parse(task.running_context || "{}"),
    session_meta: JSON.parse(task.session_meta || "{}"),
    completed_steps,
    artifacts: artifacts.map((a) => ({
      step: a.step_order,
      type: a.artifact_type,
      title: a.title,
      file_path: a.file_path,
      git_ref: a.git_ref,
      git_branch: a.git_branch,
      url: a.url,
    })),
    last_session: lastLog
      ? {
          session_id: lastLog.session_id,
          user_name: lastLog.user_name,
          agent_id: lastLog.agent_id,
          completed_at: lastLog.completed_at,
        }
      : null,
  };
}

// 4. advance — 다음 노드로 전진
server.tool(
  "advance",
  "다음 노드로 전진합니다. peek=true이면 현재 상태만 반환합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    peek: z
      .boolean()
      .optional()
      .describe("true면 현재 상태만 반환, 전진하지 않음 (기본: false)"),
  },
  async ({ task_id, peek }) => {
    const { rows: taskRows } = await pool.query(
      "SELECT * FROM tasks WHERE id = $1",
      [task_id],
    );
    const task = taskRows[0] as Task | undefined;
    if (!task) return errorResult("태스크를 찾을 수 없습니다");

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) as count FROM chain_nodes WHERE chain_id = $1",
      [task.chain_id],
    );
    const totalSteps = countRows[0] as { count: string };

    // peek 모드: 현재 상태만 반환
    if (peek) {
      const { rows: currentNodeRows } = await pool.query(
        "SELECT * FROM chain_nodes WHERE chain_id = $1 AND step_order = $2",
        [task.chain_id, task.current_step],
      );
      const currentNode = currentNodeRows[0] as ChainNode | undefined;

      let currentLog: TaskLog | undefined;
      if (currentNode) {
        const { rows: logRows } = await pool.query(
          "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
          [task_id, currentNode.id],
        );
        currentLog = logRows[0] as TaskLog | undefined;
      }

      // 현재 스텝의 코멘트 조회
      const { rows: comments } = await pool.query(
        "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
        [task_id, task.current_step],
      );

      return jsonResult({
        task_id,
        current_step: task.current_step,
        total_steps: Number(totalSteps.count),
        status: task.status,
        context: task.context,
        node: currentNode
          ? {
              node_id: currentNode.id,
              step_order: currentNode.step_order,
              node_type: currentNode.node_type,
              title: currentNode.title,
              instruction: await resolveInstruction(currentNode),
              auto_advance: !!currentNode.auto_advance,
              loop_back_to: currentNode.loop_back_to,
              credentials: await resolveCredential(currentNode),
            }
          : null,
        log_status: currentLog?.status ?? null,
        structured_output: currentLog?.structured_output ?? null,
        web_response: currentLog?.web_response ?? null,
        comments: comments.length > 0 ? comments : null,
        task_context: await buildTaskContext(task),
      });
    }

    // 전진 모드: 현재 step의 로그가 completed인지 확인
    const { rows: currentNodeRows } = await pool.query(
      "SELECT * FROM chain_nodes WHERE chain_id = $1 AND step_order = $2",
      [task.chain_id, task.current_step],
    );
    const currentNode = currentNodeRows[0] as ChainNode | undefined;

    if (currentNode) {
      const { rows: logRows } = await pool.query(
        "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
        [task_id, currentNode.id],
      );
      const currentLog = logRows[0] as TaskLog | undefined;

      if (!currentLog || currentLog.status !== "completed") {
        return errorResult(
          `현재 스텝(${task.current_step})이 아직 완료되지 않았습니다. execute_step으로 먼저 완료하세요.`,
        );
      }
    }

    // 다음 스텝으로 이동
    const nextStep = task.current_step + 1;
    const { rows: nextNodeRows } = await pool.query(
      "SELECT * FROM chain_nodes WHERE chain_id = $1 AND step_order = $2",
      [task.chain_id, nextStep],
    );
    const nextNode = nextNodeRows[0] as ChainNode | undefined;

    if (!nextNode) {
      // 더 이상 노드 없음 → 체인 완료
      await pool.query(
        "UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [task_id],
      );

      notifyRelay({ type: "task_update", task_id, event: "finished" });

      return jsonResult({
        task_id,
        finished: true,
        message: "모든 단계가 완료되었습니다.",
      });
    }

    // 다음 스텝으로 업데이트
    await pool.query(
      "UPDATE tasks SET current_step = $1, updated_at = NOW() WHERE id = $2",
      [nextStep, task_id],
    );

    // 다음 노드의 pending 로그 생성
    await pool.query(
      "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
      [
        task_id,
        nextNode.id,
        nextNode.step_order,
        nextNode.title,
        nextNode.node_type,
      ],
    );

    notifyRelay({
      type: "task_update",
      task_id,
      event: "advanced",
      data: { step: nextStep },
    });

    // web_response 확인
    const { rows: newLogRows } = await pool.query(
      "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
      [task_id, nextNode.id],
    );
    const newLog = newLogRows[0] as TaskLog | undefined;

    // 다음 스텝의 코멘트 조회
    const { rows: nextComments } = await pool.query(
      "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
      [task_id, nextStep],
    );

    return jsonResult({
      task_id,
      finished: false,
      total_steps: Number(totalSteps.count),
      context: task.context,
      current_step: {
        node_id: nextNode.id,
        step_order: nextNode.step_order,
        node_type: nextNode.node_type,
        title: nextNode.title,
        instruction: await resolveInstruction(nextNode),
        auto_advance: !!nextNode.auto_advance,
        loop_back_to: nextNode.loop_back_to,
        credentials: await resolveCredential(nextNode),
      },
      web_response: newLog?.web_response ?? null,
      comments: nextComments.length > 0 ? nextComments : null,
      task_context: await buildTaskContext(task),
    });
  },
);

// 5. complete_task — 최종 완료 처리
server.tool(
  "complete_task",
  "태스크를 최종 완료 또는 실패로 처리합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    status: z.enum(["completed", "failed"]).describe("최종 상태"),
    summary: z.string().optional().describe("최종 요약 (선택)"),
  },
  async ({ task_id, status, summary }) => {
    await pool.query(
      "UPDATE tasks SET status = $1, summary = $2, updated_at = NOW() WHERE id = $3",
      [status, summary ?? "", task_id],
    );

    const { rows: logs } = await pool.query(
      "SELECT step_order, status, output FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
      [task_id],
    );

    notifyRelay({
      type: "task_update",
      task_id,
      event: "completed",
      data: { status, steps: logs.length },
    });

    return jsonResult({
      task_id,
      status,
      steps_completed: logs.length,
      logs,
    });
  },
);

// 6. heartbeat — 진행 중 상태 업데이트
server.tool(
  "heartbeat",
  "실행 중인 태스크의 진행 상황을 업데이트합니다 (중간 출력 저장).",
  {
    task_id: z.number().describe("태스크 ID"),
    node_id: z.number().describe("현재 노드 ID"),
    progress: z.string().describe("현재 진행 상황 메시지"),
  },
  async ({ task_id, node_id, progress }) => {
    const { rows: logRows } = await pool.query(
      "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('running', 'pending') ORDER BY id DESC LIMIT 1",
      [task_id, node_id],
    );
    const log = logRows[0] as TaskLog | undefined;

    if (log) {
      const updated = log.output ? `${log.output}\n${progress}` : progress;
      await pool.query("UPDATE task_logs SET output = $1 WHERE id = $2", [
        updated,
        log.id,
      ]);
    }

    await pool.query("UPDATE tasks SET updated_at = NOW() WHERE id = $1", [
      task_id,
    ]);

    notifyRelay({
      type: "task_update",
      task_id,
      event: "heartbeat",
      data: { node_id, progress },
    });

    return jsonResult({ success: true, task_id, node_id });
  },
);

// 7. submit_visual — HTML 아티팩트 저장
server.tool(
  "submit_visual",
  "HTML 아티팩트를 해당 태스크 로그에 저장합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    node_id: z.number().describe("노드 ID"),
    html: z.string().describe("저장할 HTML 콘텐츠"),
  },
  async ({ task_id, node_id, html }) => {
    const { rows: logRows } = await pool.query(
      "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
      [task_id, node_id],
    );
    const log = logRows[0] as TaskLog | undefined;

    if (!log) {
      return errorResult(
        `task_id=${task_id}, node_id=${node_id}에 대한 로그를 찾을 수 없습니다`,
      );
    }

    await pool.query("UPDATE task_logs SET visual_html = $1 WHERE id = $2", [
      html,
      log.id,
    ]);

    notifyRelay({
      type: "task_update",
      task_id,
      event: "visual_submitted",
      data: { node_id },
    });

    return jsonResult({ success: true, task_id, node_id, log_id: log.id });
  },
);

// 8. get_web_response — 웹 UI 응답 조회
server.tool(
  "get_web_response",
  "웹 UI에서 입력된 응답을 조회합니다. null이면 아직 미응답입니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    node_id: z.number().describe("노드 ID"),
  },
  async ({ task_id, node_id }) => {
    const { rows: logRows } = await pool.query(
      "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
      [task_id, node_id],
    );
    const log = logRows[0] as TaskLog | undefined;

    if (!log) {
      return errorResult(
        `task_id=${task_id}, node_id=${node_id}에 대한 로그를 찾을 수 없습니다`,
      );
    }

    return jsonResult({
      task_id,
      node_id,
      web_response: log.web_response,
      has_response: log.web_response !== null,
    });
  },
);

// 9. rewind — 특정 스텝으로 되돌아가기
server.tool(
  "rewind",
  "특정 스텝으로 되돌아갑니다. 현재 pending/running 로그를 cancelled로 처리하고, 대상 스텝에 새 pending 로그를 생성합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    to_step: z.number().describe("되돌아갈 스텝 번호"),
  },
  async ({ task_id, to_step }) => {
    const { rows: taskRows } = await pool.query(
      "SELECT * FROM tasks WHERE id = $1",
      [task_id],
    );
    const task = taskRows[0] as Task | undefined;
    if (!task) return errorResult("태스크를 찾을 수 없습니다");

    const { rows: targetNodeRows } = await pool.query(
      "SELECT * FROM chain_nodes WHERE chain_id = $1 AND step_order = $2",
      [task.chain_id, to_step],
    );
    const targetNode = targetNodeRows[0] as ChainNode | undefined;
    if (!targetNode) return errorResult(`스텝 ${to_step}을 찾을 수 없습니다`);

    // 현재 pending/running 로그를 cancelled로 처리
    await pool.query(
      "UPDATE task_logs SET status = 'cancelled', completed_at = NOW() WHERE task_id = $1 AND status IN ('pending', 'running')",
      [task_id],
    );

    // current_step을 대상 스텝으로 되돌리기
    await pool.query(
      "UPDATE tasks SET current_step = $1, updated_at = NOW() WHERE id = $2",
      [to_step, task_id],
    );

    // 대상 스텝에 새 pending 로그 생성
    await pool.query(
      "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
      [task_id, targetNode.id, to_step, targetNode.title, targetNode.node_type],
    );

    // 해당 스텝의 코멘트 조회
    const { rows: comments } = await pool.query(
      "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
      [task_id, to_step],
    );

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) as count FROM chain_nodes WHERE chain_id = $1",
      [task.chain_id],
    );
    const totalSteps = countRows[0] as { count: string };

    notifyRelay({
      type: "task_update",
      task_id,
      event: "rewound",
      data: { to_step },
    });

    return jsonResult({
      task_id,
      rewound_to: to_step,
      total_steps: Number(totalSteps.count),
      current_step: {
        node_id: targetNode.id,
        step_order: targetNode.step_order,
        node_type: targetNode.node_type,
        title: targetNode.title,
        instruction: await resolveInstruction(targetNode),
        auto_advance: !!targetNode.auto_advance,
        loop_back_to: targetNode.loop_back_to,
        credentials: await resolveCredential(targetNode),
      },
      comments: comments.length > 0 ? comments : null,
    });
  },
);

// 10. get_comments — 특정 스텝의 코멘트 조회
server.tool(
  "get_comments",
  "특정 태스크의 특정 스텝에 달린 코멘트를 조회합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    step_order: z
      .number()
      .optional()
      .describe("스텝 번호 (생략 시 전체 코멘트)"),
  },
  async ({ task_id, step_order }) => {
    const { rows: comments } = step_order
      ? await pool.query(
          "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
          [task_id, step_order],
        )
      : await pool.query(
          "SELECT * FROM task_comments WHERE task_id = $1 ORDER BY step_order ASC, created_at DESC",
          [task_id],
        );

    return jsonResult({ task_id, step_order: step_order ?? "all", comments });
  },
);

// 11. create_workflow — 워크플로 생성
server.tool(
  "create_workflow",
  "워크플로(체인)를 생성합니다. 제목, 설명, 단계(노드) 목록을 한 번에 전달합니다.",
  {
    title: z.string().describe("워크플로 제목"),
    description: z.string().optional().describe("워크플로 설명"),
    version: z.string().optional().describe("워크플로 버전 (기본: 1.0)"),
    parent_chain_id: z.number().optional().describe("부모 워크플로 ID"),
    evaluation_contract: evaluationContractSchema.optional(),
    nodes: z
      .array(
        z.object({
          title: z.string().describe("단계 제목"),
          node_type: z
            .enum(["action", "gate", "loop"])
            .optional()
            .describe("단계 타입 (기본: action)"),
          instruction: z.string().optional().describe("에이전트 지침 (인라인)"),
          instruction_id: z.number().optional().describe("기존 지침 참조 ID"),
          auto_advance: z
            .boolean()
            .optional()
            .describe("자동 진행 여부 (기본: false)"),
          loop_back_to: z
            .number()
            .optional()
            .describe("loop 노드의 되돌아갈 스텝 번호"),
          credential_id: z.number().optional().describe("연결할 credential ID"),
        }),
      )
      .describe("단계 목록 (순서대로)"),
  },
  async ({
    title,
    description,
    version,
    parent_chain_id,
    evaluation_contract,
    nodes,
  }) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const normalizedVersion =
        version && version.trim().length > 0 ? version.trim() : "1.0";

      const { rows: chainRows } = await client.query<Chain>(
        "INSERT INTO chains (title, description, version, parent_chain_id, evaluation_contract) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, title, description, version, parent_chain_id, evaluation_contract",
        [
          title.trim(),
          (description ?? "").trim(),
          normalizedVersion,
          parent_chain_id ?? null,
          serializeJsonb(evaluation_contract),
        ],
      );
      const chain = chainRows[0];
      const chainId = chain.id;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        await client.query(
          "INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [
            chainId,
            i + 1,
            (node.node_type ?? "action").trim(),
            node.title.trim(),
            (node.instruction ?? "").trim(),
            node.instruction_id ?? null,
            node.loop_back_to ?? null,
            node.auto_advance ? 1 : 0,
            node.credential_id ?? null,
          ],
        );
      }

      await client.query("COMMIT");

      const { rows: savedNodes } = await pool.query(
        "SELECT id, step_order, node_type, title, auto_advance FROM chain_nodes WHERE chain_id = $1 ORDER BY step_order ASC",
        [chainId],
      );

      notifyRelay({
        type: "task_update",
        task_id: 0,
        event: "workflow_created",
        data: { chain_id: chainId, title },
      });

      return jsonResult({
        chain_id: chainId,
        title,
        version: chain.version,
        parent_chain_id: chain.parent_chain_id,
        evaluation_contract: chain.evaluation_contract,
        total_steps: savedNodes.length,
        nodes: savedNodes.map((n) => ({
          ...n,
          auto_advance: !!n.auto_advance,
        })),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
);

// 12. update_workflow — 워크플로 수정
server.tool(
  "update_workflow",
  "워크플로를 수정합니다. 메타 정보만 수정하거나, 노드 전체를 교체할 수 있습니다.",
  {
    chain_id: z.number().describe("워크플로 ID"),
    title: z.string().optional().describe("변경할 제목"),
    description: z.string().optional().describe("변경할 설명"),
    evaluation_contract: evaluationContractSchema
      .optional()
      .describe("변경할 평가 계약(JSON 객체)"),
    nodes: z
      .array(
        z.object({
          title: z.string(),
          node_type: z.enum(["action", "gate", "loop"]).optional(),
          instruction: z.string().optional(),
          instruction_id: z.number().optional(),
          auto_advance: z.boolean().optional(),
          loop_back_to: z.number().optional(),
          credential_id: z.number().optional(),
        }),
      )
      .optional()
      .describe("노드 목록 (전달하면 기존 노드를 모두 교체)"),
  },
  async ({ chain_id, title, description, evaluation_contract, nodes }) => {
    const { rows: existingRows } = await pool.query<Chain>(
      "SELECT id, title, description, version, parent_chain_id, evaluation_contract FROM chains WHERE id = $1",
      [chain_id],
    );
    const existing = existingRows[0];
    if (!existing) return errorResult("워크플로를 찾을 수 없습니다");

    const nextTitle = (title ?? existing.title).trim();
    const nextDescription = (description ?? existing.description).trim();
    const nextEvaluationContract =
      evaluation_contract ?? existing.evaluation_contract;

    const client = await pool.connect();
    let savedChainId = chain_id;
    let savedVersion = existing.version;
    let savedParentChainId = existing.parent_chain_id;
    let savedEvaluationContract = existing.evaluation_contract;
    try {
      await client.query("BEGIN");

      if (nodes) {
        const { rows: familyRows } = await client.query<Pick<Chain, "version">>(
          "SELECT version FROM chains WHERE title = $1",
          [existing.title],
        );
        const latestVersion =
          familyRows.length > 0
            ? [...familyRows].sort((a, b) =>
                compareVersions(b.version, a.version),
              )[0].version
            : existing.version;
        const newVersion = incrementVersion(latestVersion);

        const { rows: insertedChainRows } = await client.query<Chain>(
          "INSERT INTO chains (title, description, version, parent_chain_id, evaluation_contract) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, title, description, version, parent_chain_id, evaluation_contract",
          [
            nextTitle,
            nextDescription,
            newVersion,
            chain_id,
            serializeJsonb(nextEvaluationContract),
          ],
        );
        const insertedChain = insertedChainRows[0];

        savedChainId = insertedChain.id;
        savedVersion = insertedChain.version;
        savedParentChainId = insertedChain.parent_chain_id;
        savedEvaluationContract = insertedChain.evaluation_contract;

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          await client.query(
            "INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
              savedChainId,
              i + 1,
              (node.node_type ?? "action").trim(),
              node.title.trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              node.auto_advance ? 1 : 0,
              node.credential_id ?? null,
            ],
          );
        }
      } else {
        const { rows: updatedChainRows } = await client.query<Chain>(
          "UPDATE chains SET title = $1, description = $2, evaluation_contract = $3::jsonb, updated_at = NOW() WHERE id = $4 RETURNING id, title, description, version, parent_chain_id, evaluation_contract",
          [
            nextTitle,
            nextDescription,
            serializeJsonb(nextEvaluationContract),
            chain_id,
          ],
        );
        const updatedChain = updatedChainRows[0];

        savedChainId = updatedChain.id;
        savedVersion = updatedChain.version;
        savedParentChainId = updatedChain.parent_chain_id;
        savedEvaluationContract = updatedChain.evaluation_contract;
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const { rows: savedNodes } = await pool.query(
      "SELECT id, step_order, node_type, title, auto_advance FROM chain_nodes WHERE chain_id = $1 ORDER BY step_order ASC",
      [savedChainId],
    );

    return jsonResult({
      chain_id: savedChainId,
      title: nextTitle,
      version: savedVersion,
      parent_chain_id: savedParentChainId,
      evaluation_contract: savedEvaluationContract,
      total_steps: savedNodes.length,
      nodes: savedNodes.map((n) => ({
        ...n,
        auto_advance: !!n.auto_advance,
      })),
    });
  },
);

// 13. delete_workflow — 워크플로 삭제
server.tool(
  "delete_workflow",
  "워크플로를 삭제합니다. 연결된 노드도 함께 삭제됩니다 (CASCADE).",
  {
    chain_id: z.number().describe("삭제할 워크플로 ID"),
  },
  async ({ chain_id }) => {
    const result = await pool.query("DELETE FROM chains WHERE id = $1", [
      chain_id,
    ]);

    if (result.rowCount === 0) {
      return errorResult("워크플로를 찾을 수 없습니다");
    }

    notifyRelay({
      type: "task_update",
      task_id: 0,
      event: "workflow_deleted",
      data: { chain_id },
    });

    return jsonResult({ chain_id, deleted: true });
  },
);

// 14. list_credentials — credential 목록 조회
server.tool(
  "list_credentials",
  "사용 가능한 credential 목록을 조회합니다 (secrets는 마스킹).",
  {},
  async () => {
    const { rows } = await pool.query(
      "SELECT id, service_name, title, description, secrets, created_at FROM credentials ORDER BY service_name ASC",
    );
    const result = rows.map((r: any) => ({
      id: r.id,
      service_name: r.service_name,
      title: r.title,
      description: r.description,
      secrets_masked: maskSecrets(r.secrets),
    }));
    return jsonResult(result);
  },
);

// ─── Git 헬퍼 ───

async function gitExec(
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, {
    cwd: cwd ?? process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
}

// 14. save_artifacts — Git 브랜치에 아티팩트 저장
server.tool(
  "save_artifacts",
  "현재 작업 디렉토리의 변경사항을 omegarod/task-{id} 브랜치에 커밋하고 원격에 푸시합니다. 다른 세션에서 load_artifacts로 복원 가능합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    message: z.string().describe("커밋 메시지"),
    file_paths: z
      .array(z.string())
      .optional()
      .describe("커밋할 파일 경로 목록 (생략 시 모든 변경사항)"),
    working_dir: z
      .string()
      .optional()
      .describe("작업 디렉토리 (생략 시 현재 디렉토리)"),
  },
  async ({ task_id, message, file_paths, working_dir }) => {
    const cwd = working_dir ?? process.cwd();
    const branchName = `omegarod/task-${task_id}`;

    try {
      // 현재 브랜치 저장
      const { stdout: currentBranch } = await gitExec(
        ["rev-parse", "--abbrev-ref", "HEAD"],
        cwd,
      );
      const originalBranch = currentBranch.trim();

      // 현재 HEAD 커밋 해시
      const { stdout: headRef } = await gitExec(["rev-parse", "HEAD"], cwd);

      // omegarod 브랜치가 이미 있는지 확인
      let branchExists = false;
      try {
        await gitExec(["rev-parse", "--verify", branchName], cwd);
        branchExists = true;
      } catch {
        // 브랜치 없음
      }

      // 변경사항을 stash에 임시 저장
      await gitExec(["stash", "push", "-m", `omegarod-save-${task_id}`], cwd);

      try {
        // omegarod 브랜치로 전환 또는 생성
        if (branchExists) {
          await gitExec(["checkout", branchName], cwd);
          // 원본 브랜치의 최신 상태를 가져옴
          try {
            await gitExec(["merge", originalBranch, "--no-edit"], cwd);
          } catch {
            // 충돌 시 원본 우선
            await gitExec(["merge", "--abort"], cwd);
            await gitExec(["reset", "--hard", originalBranch], cwd);
          }
        } else {
          await gitExec(["checkout", "-b", branchName], cwd);
        }

        // stash 복원
        try {
          await gitExec(["stash", "pop"], cwd);
        } catch {
          // stash가 비어있으면 무시
        }

        // 파일 스테이징
        if (file_paths && file_paths.length > 0) {
          await gitExec(["add", ...file_paths], cwd);
        } else {
          await gitExec(["add", "-A"], cwd);
        }

        // 커밋할 변경사항 확인
        let commitRef = "";
        try {
          const { stdout: diffStat } = await gitExec(
            ["diff", "--cached", "--stat"],
            cwd,
          );
          if (!diffStat.trim()) {
            // 변경사항 없으면 원본 브랜치로 복귀
            await gitExec(["checkout", originalBranch], cwd);
            return jsonResult({
              task_id,
              branch: branchName,
              status: "no_changes",
              message: "커밋할 변경사항이 없습니다.",
            });
          }

          await gitExec(
            ["commit", "-m", `[omegarod] task-${task_id}: ${message}`],
            cwd,
          );

          const { stdout: ref } = await gitExec(["rev-parse", "HEAD"], cwd);
          commitRef = ref.trim();
        } catch (e) {
          // 커밋 실패 시 원본 브랜치로 복귀
          await gitExec(["checkout", originalBranch], cwd);
          throw e;
        }

        // 원격에 푸시
        let pushed = false;
        try {
          await gitExec(["push", "-u", "origin", branchName], cwd);
          pushed = true;
        } catch {
          // 원격이 없거나 권한 없으면 로컬에만 저장
        }

        // 원본 브랜치로 복귀
        await gitExec(["checkout", originalBranch], cwd);

        // DB에 아티팩트 기록
        const { rows: taskRows } = await pool.query(
          "SELECT current_step FROM tasks WHERE id = $1",
          [task_id],
        );
        const task = taskRows[0] as { current_step: number } | undefined;

        if (task) {
          await pool.query(
            "INSERT INTO task_artifacts (task_id, step_order, artifact_type, title, git_ref, git_branch) VALUES ($1, $2, 'git_commit', $3, $4, $5)",
            [task_id, task.current_step, message, commitRef, branchName],
          );
        }

        return jsonResult({
          task_id,
          branch: branchName,
          commit: commitRef,
          pushed,
          status: "saved",
        });
      } catch (e) {
        // 실패 시 원본 브랜치 복귀 시도
        try {
          await gitExec(["checkout", originalBranch], cwd);
          await gitExec(["stash", "pop"], cwd);
        } catch {
          // 무시
        }
        throw e;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return errorResult(`Git 아티팩트 저장 실패: ${msg}`);
    }
  },
);

// 15. load_artifacts — Git 브랜치에서 아티팩트 조회
server.tool(
  "load_artifacts",
  "특정 태스크의 omegarod/task-{id} 브랜치에서 파일 목록과 내용을 조회합니다. 코드 재현이 필요할 때 사용합니다.",
  {
    task_id: z.number().describe("태스크 ID"),
    file_path: z
      .string()
      .optional()
      .describe("특정 파일 내용을 읽을 경로 (생략 시 변경된 파일 목록만 반환)"),
    working_dir: z
      .string()
      .optional()
      .describe("작업 디렉토리 (생략 시 현재 디렉토리)"),
  },
  async ({ task_id, file_path, working_dir }) => {
    const cwd = working_dir ?? process.cwd();
    const branchName = `omegarod/task-${task_id}`;

    try {
      // 원격에서 최신 가져오기
      try {
        await gitExec(["fetch", "origin", branchName], cwd);
      } catch {
        // 원격 브랜치 없으면 로컬만 확인
      }

      // 브랜치 존재 확인 (로컬 또는 원격)
      let refName = "";
      try {
        await gitExec(["rev-parse", "--verify", branchName], cwd);
        refName = branchName;
      } catch {
        try {
          await gitExec(["rev-parse", "--verify", `origin/${branchName}`], cwd);
          refName = `origin/${branchName}`;
        } catch {
          return errorResult(
            `브랜치 ${branchName}을 찾을 수 없습니다 (로컬/원격 모두).`,
          );
        }
      }

      if (file_path) {
        // 특정 파일 내용 읽기
        try {
          const { stdout: content } = await gitExec(
            ["show", `${refName}:${file_path}`],
            cwd,
          );
          return jsonResult({
            task_id,
            branch: branchName,
            file_path,
            content,
          });
        } catch {
          return errorResult(
            `${branchName} 브랜치에서 ${file_path}를 찾을 수 없습니다.`,
          );
        }
      }

      // 메인 브랜치 대비 변경된 파일 목록
      let baseBranch = "main";
      try {
        const { stdout } = await gitExec(
          ["symbolic-ref", "refs/remotes/origin/HEAD"],
          cwd,
        );
        baseBranch = stdout.trim().replace("refs/remotes/origin/", "");
      } catch {
        // main 기본값 사용
      }

      // omegarod 브랜치의 커밋 로그
      const { stdout: logOutput } = await gitExec(
        [
          "log",
          refName,
          `--not`,
          baseBranch,
          "--oneline",
          "--no-decorate",
          "-20",
        ],
        cwd,
      );

      // 변경된 파일 목록
      let changedFiles = "";
      try {
        const { stdout } = await gitExec(
          ["diff", "--name-status", `${baseBranch}...${refName}`],
          cwd,
        );
        changedFiles = stdout;
      } catch {
        // diff 실패 시 tree로 대체
        const { stdout } = await gitExec(
          ["ls-tree", "-r", "--name-only", refName],
          cwd,
        );
        changedFiles = stdout;
      }

      // DB에서 아티팩트 메타데이터 조회
      const { rows: artifacts } = await pool.query<TaskArtifact>(
        "SELECT * FROM task_artifacts WHERE task_id = $1 ORDER BY step_order ASC, id ASC",
        [task_id],
      );

      return jsonResult({
        task_id,
        branch: branchName,
        ref: refName,
        commits: logOutput.trim().split("\n").filter(Boolean),
        changed_files: changedFiles.trim().split("\n").filter(Boolean),
        db_artifacts: artifacts.map((a) => ({
          step: a.step_order,
          type: a.artifact_type,
          title: a.title,
          file_path: a.file_path,
          git_ref: a.git_ref,
        })),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return errorResult(`Git 아티팩트 조회 실패: ${msg}`);
    }
  },
);

// ─── 실행 ───

async function main() {
  await validateStartupApiKey();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
