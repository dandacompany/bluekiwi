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
    "List workflows on the BlueKiwi server. By default only active versions are returned. Pass include_inactive=true to see archived versions as well.",
    {
      include_inactive: { type: "boolean" },
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
    "Start a task from a workflow id. Optionally pin a specific version within the same family. Starting against an archived (inactive) version fails with HTTP 409.",
    {
      workflow_id: { type: "number" },
      version: { type: "string" },
      context: { type: "string" },
      session_meta: { type: "string" },
      target: { type: "object" },
    },
    ["workflow_id"],
  ),
  tool(
    "execute_step",
    "Submit the result for the current workflow step",
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
    "Advance a task to the next step or inspect the current step",
    {
      task_id: { type: "number" },
      peek: { type: "boolean" },
    },
    ["task_id"],
  ),
  tool(
    "heartbeat",
    "Append progress information for a running task step",
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
    "Fetch the pending web response payload for a task",
    {
      task_id: { type: "number" },
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
    "create_workflow",
    "Create a new workflow",
    {
      title: { type: "string" },
      description: { type: "string" },
      version: { type: "string" },
      parent_workflow_id: { type: "number" },
      evaluation_contract: { type: "object" },
      nodes: { type: "array" },
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
        const includeInactive = args.include_inactive === true;
        const path = includeInactive
          ? "/api/workflows?include_inactive=true"
          : "/api/workflows";
        return wrap(await client.request("GET", path));
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
      case "start_workflow":
        return wrap(await client.request("POST", "/api/tasks/start", args));
      case "execute_step": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
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
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/respond`),
        );
      }
      case "submit_visual": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/visual`, body),
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
      case "create_workflow":
        return wrap(await client.request("POST", "/api/workflows", args));
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
      case "scan_repo":
        return await scanRepoLocal(args);
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
