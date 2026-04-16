import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { resolveAppRuntime } from "./runtime-artifacts.js";

export interface LocalRuntimeOptions {
  profile?: string;
  host?: string;
  port?: number;
  open?: boolean;
  foreground?: boolean;
  dataDir?: string;
}

export interface LocalRuntimeRecord {
  profile: string;
  pid: number;
  host: string;
  port: number;
  url: string;
  healthUrl: string;
  appRoot: string;
  runtimeKind: "source" | "bundle";
  runtimeSource: string;
  dataDir: string;
  sqlitePath: string;
  logFile: string;
  startedAt: string;
}

const DEFAULT_LOCAL_PROFILE = "default";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3102;
const MAX_PORT_SCAN = 20;

function normalizeProfileName(name?: string): string {
  const trimmed = name?.trim();
  return trimmed || DEFAULT_LOCAL_PROFILE;
}

function quickstartRoot(profile?: string): string {
  return join(
    homedir(),
    ".bluekiwi",
    "quickstart",
    normalizeProfileName(profile),
  );
}

function quickstartRunDir(profile?: string): string {
  return join(quickstartRoot(profile), "run");
}

function quickstartLogDir(profile?: string): string {
  return join(quickstartRoot(profile), "logs");
}

function runtimeRecordPath(profile?: string): string {
  return join(quickstartRunDir(profile), "app.json");
}

function ensureDir(pathname: string): void {
  mkdirSync(pathname, { recursive: true });
}

async function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once("error", () => resolvePromise(false));
    server.once("listening", () => {
      server.close(() => resolvePromise(true));
    });
    server.listen(port, host);
  });
}

export async function findFreePort(
  startPort = DEFAULT_PORT,
  host = DEFAULT_HOST,
): Promise<number> {
  for (let port = startPort; port < startPort + MAX_PORT_SCAN; port += 1) {
    if (await isPortFree(port, host)) return port;
  }
  throw new Error(
    `No free port found from ${startPort} to ${startPort + MAX_PORT_SCAN - 1}`,
  );
}

export function readLocalRuntimeRecord(
  profile?: string,
): LocalRuntimeRecord | null {
  const recordPath = runtimeRecordPath(profile);
  if (!existsSync(recordPath)) return null;
  try {
    return JSON.parse(readFileSync(recordPath, "utf8")) as LocalRuntimeRecord;
  } catch {
    return null;
  }
}

function removeLocalRuntimeRecord(profile?: string): void {
  rmSync(runtimeRecordPath(profile), { force: true });
}

export function isLocalRuntimeRunning(profile?: string): boolean {
  const record = readLocalRuntimeRecord(profile);
  if (!record) return false;
  try {
    process.kill(record.pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function checkLocalRuntimeHealth(
  record: LocalRuntimeRecord,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(record.healthUrl, {
      method: "GET",
      redirect: "manual",
    });
    if (response.status >= 200 && response.status < 400) {
      return { ok: true, status: response.status };
    }
    return { ok: false, status: response.status };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function startLocalRuntime(
  options: LocalRuntimeOptions = {},
): Promise<LocalRuntimeRecord> {
  const profile = normalizeProfileName(options.profile);
  const existing = readLocalRuntimeRecord(profile);
  if (existing && isLocalRuntimeRunning(profile)) {
    return existing;
  }

  const runtime = resolveAppRuntime();
  const appRoot = runtime.root;
  const root = options.dataDir
    ? resolve(options.dataDir)
    : quickstartRoot(profile);
  const runDir = quickstartRunDir(profile);
  const logDir = quickstartLogDir(profile);
  ensureDir(root);
  ensureDir(runDir);
  ensureDir(logDir);

  const host = options.host?.trim() || DEFAULT_HOST;
  const port = await findFreePort(options.port ?? DEFAULT_PORT, host);
  const sqlitePath = join(root, "data", "bluekiwi.sqlite");
  const logFile = join(logDir, "app.log");
  ensureDir(dirname(sqlitePath));

  const env = {
    ...process.env,
    DB_TYPE: "sqlite",
    SQLITE_PATH: sqlitePath,
    NEXT_TELEMETRY_DISABLED: "1",
    APP_PORT: String(port),
    PUBLIC_URL: `http://${host}:${port}`,
    HOSTNAME: host,
    PORT: String(port),
  };

  if (options.foreground) {
    const child =
      runtime.kind === "bundle"
        ? spawn("node", [join(appRoot, "server.js")], {
            cwd: appRoot,
            env,
            stdio: "inherit",
          })
        : spawn(
            "npm",
            [
              "run",
              "dev:raw",
              "--",
              "--hostname",
              host,
              "--port",
              String(port),
            ],
            {
              cwd: appRoot,
              env,
              stdio: "inherit",
            },
          );
    const record: LocalRuntimeRecord = {
      profile,
      pid: child.pid ?? process.pid,
      host,
      port,
      url: `http://${host}:${port}`,
      healthUrl: `http://${host}:${port}/login`,
      appRoot,
      runtimeKind: runtime.kind,
      runtimeSource: runtime.source,
      dataDir: root,
      sqlitePath,
      logFile,
      startedAt: new Date().toISOString(),
    };
    writeFileSync(runtimeRecordPath(profile), JSON.stringify(record, null, 2));
    return record;
  }

  const child =
    runtime.kind === "bundle"
      ? spawn("node", [join(appRoot, "server.js")], {
          cwd: appRoot,
          env,
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
        })
      : spawn(
          "npm",
          ["run", "dev:raw", "--", "--hostname", host, "--port", String(port)],
          {
            cwd: appRoot,
            env,
            detached: true,
            stdio: ["ignore", "ignore", "ignore"],
          },
        );
  child.unref();
  if (child.pid == null) {
    throw new Error("failed to start local runtime process");
  }

  const record: LocalRuntimeRecord = {
    profile,
    pid: child.pid,
    host,
    port,
    url: `http://${host}:${port}`,
    healthUrl: `http://${host}:${port}/login`,
    appRoot,
    runtimeKind: runtime.kind,
    runtimeSource: runtime.source,
    dataDir: root,
    sqlitePath,
    logFile,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(runtimeRecordPath(profile), JSON.stringify(record, null, 2));

  if (options.open) {
    spawn("open", [`http://${host}:${port}`], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }

  return record;
}

export function stopLocalRuntime(profile?: string): LocalRuntimeRecord | null {
  const record = readLocalRuntimeRecord(profile);
  if (!record) return null;

  try {
    process.kill(record.pid, "SIGTERM");
  } catch {
    removeLocalRuntimeRecord(profile);
    return record;
  }

  removeLocalRuntimeRecord(profile);
  return record;
}

export async function getLocalRuntimeStatus(profile?: string): Promise<{
  record: LocalRuntimeRecord | null;
  running: boolean;
  stale: boolean;
  healthy: boolean;
  healthStatus?: number;
  healthError?: string;
}> {
  const record = readLocalRuntimeRecord(profile);
  if (!record) {
    return { record: null, running: false, stale: false, healthy: false };
  }
  const running = isLocalRuntimeRunning(profile);
  if (!running) {
    removeLocalRuntimeRecord(profile);
    return { record, running: false, stale: true, healthy: false };
  }
  const health = await checkLocalRuntimeHealth(record);
  return {
    record,
    running,
    stale: false,
    healthy: health.ok,
    healthStatus: health.status,
    healthError: health.error,
  };
}
