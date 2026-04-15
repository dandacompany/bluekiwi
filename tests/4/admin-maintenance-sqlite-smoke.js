import path from "node:path";
import Database from "better-sqlite3";

const TARGET_URL = process.env.TARGET_URL || "http://127.0.0.1:3520";
const SQLITE_PATH =
  process.env.SQLITE_PATH || "/tmp/bluekiwi-admin-smoke/data/bluekiwi.sqlite";
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || "sqlite-admin@example.com";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "Passw0rd!";

function getDb() {
  return new Database(path.resolve(SQLITE_PATH));
}

function ageTask(taskId, minutes) {
  const db = getDb();
  try {
    db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(
      new Date(Date.now() - minutes * 60 * 1000).toISOString(),
      taskId,
    );
  } finally {
    db.close();
  }
}

function fetchDbValue(sql, params = []) {
  const db = getDb();
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}

async function assertJson(response, label) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} invalid JSON: ${response.status} ${text}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${text}`);
  }
  return json;
}

class SessionClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(method, pathname, body) {
    const headers = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie =
      response.headers.getSetCookie?.() ??
      (response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : []);
    if (setCookie.length > 0) {
      this.cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
    }
    return response;
  }

  get(pathname) {
    return this.request("GET", pathname);
  }

  post(pathname, body) {
    return this.request("POST", pathname, body);
  }

  put(pathname, body) {
    return this.request("PUT", pathname, body);
  }

  delete(pathname, body) {
    return this.request("DELETE", pathname, body);
  }
}

async function ensureSetup(client) {
  const setupJson = await assertJson(
    await client.get("/api/auth/setup"),
    "setup check",
  );
  if (!setupJson.needsSetup) return;
  await assertJson(
    await client.post("/api/auth/setup", {
      username: "SQLite Admin",
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    }),
    "initial setup",
  );
}

async function login(client, email, password) {
  await assertJson(
    await client.post("/api/auth/login", { email, password }),
    "login",
  );
}

async function main() {
  const admin = new SessionClient(TARGET_URL);
  await ensureSetup(admin);
  await login(admin, LOGIN_EMAIL, LOGIN_PASSWORD);
  console.log("ADMIN_LOGIN_OK");

  const wfJson = await assertJson(
    await admin.post("/api/workflows", {
      title: `Admin Smoke ${Date.now()}`,
      description: "admin maintenance sqlite smoke",
      nodes: [
        {
          title: "Single Step",
          node_type: "action",
          instruction: "noop",
        },
      ],
    }),
    "workflow create",
  );
  const workflow = wfJson.data;
  const node = workflow.nodes[0];

  const taskJson = await assertJson(
    await admin.post("/api/tasks/start", {
      workflow_id: workflow.id,
      title: "cleanup visual html task",
      context: "admin smoke",
    }),
    "task start",
  );
  const taskId = taskJson.data.task_id;

  await assertJson(
    await admin.post(`/api/tasks/${taskId}/visual`, {
      node_id: node.id,
      html: "<div>admin smoke visual html</div>",
    }),
    "set visual html",
  );
  await assertJson(
    await admin.post(`/api/tasks/${taskId}/complete`, {
      status: "completed",
      summary: "done",
    }),
    "complete task",
  );

  const cleanupBefore = await assertJson(
    await admin.get("/api/settings/cleanup-visual-html"),
    "cleanup preflight",
  );
  if (Number(cleanupBefore.affected ?? 0) < 1) {
    throw new Error(`cleanup preflight expected affected >= 1: ${JSON.stringify(cleanupBefore)}`);
  }
  const cleanupRun = await assertJson(
    await admin.post("/api/settings/cleanup-visual-html", {}),
    "cleanup run",
  );
  if (Number(cleanupRun.cleared ?? 0) < 1) {
    throw new Error(`cleanup run expected cleared >= 1: ${JSON.stringify(cleanupRun)}`);
  }
  const cleanupAfter = await assertJson(
    await admin.get("/api/settings/cleanup-visual-html"),
    "cleanup verify",
  );
  if (Number(cleanupAfter.affected ?? 0) !== 0) {
    throw new Error(`cleanup verify expected 0 affected: ${JSON.stringify(cleanupAfter)}`);
  }
  console.log("CLEANUP_VISUAL_HTML_OK");

  const staleTaskJson = await assertJson(
    await admin.post("/api/tasks/start", {
      workflow_id: workflow.id,
      title: "stale timeout task",
      context: "admin smoke stale",
    }),
    "stale task start",
  );
  const staleTaskId = staleTaskJson.data.task_id;
  ageTask(staleTaskId, 180);

  const staleList = await assertJson(
    await admin.get("/api/tasks/timeout-stale?timeout_minutes=120"),
    "timeout stale list",
  );
  if (!Array.isArray(staleList.data) || !staleList.data.some((row) => row.id === staleTaskId)) {
    throw new Error(`timeout stale list missing task ${staleTaskId}`);
  }
  const timeoutRun = await assertJson(
    await admin.post("/api/tasks/timeout-stale", { timeout_minutes: 120 }),
    "timeout stale run",
  );
  if (!Array.isArray(timeoutRun.data?.task_ids) || !timeoutRun.data.task_ids.includes(staleTaskId)) {
    throw new Error(`timeout stale did not include task ${staleTaskId}`);
  }
  const timedOutRow = fetchDbValue("SELECT status FROM tasks WHERE id = ?", [staleTaskId]);
  if (timedOutRow?.status !== "timed_out") {
    throw new Error(`expected timed_out, got ${JSON.stringify(timedOutRow)}`);
  }
  console.log("TIMEOUT_STALE_OK");

  const transferTargetJson = await assertJson(
    await admin.post("/api/users", {
      username: `transfer-target-${Date.now()}`,
      email: `transfer-target-${Date.now()}@example.com`,
      password: LOGIN_PASSWORD,
      role: "viewer",
    }),
    "create transfer target",
  );
  const transferTargetId = transferTargetJson.data.id;

  const transferSourceEmail = `transfer-source-${Date.now()}@example.com`;
  const transferSourceJson = await assertJson(
    await admin.post("/api/users", {
      username: `transfer-source-${Date.now()}`,
      email: transferSourceEmail,
      password: LOGIN_PASSWORD,
      role: "editor",
    }),
    "create transfer source",
  );
  const transferSourceId = transferSourceJson.data.id;

  const sourceClient = new SessionClient(TARGET_URL);
  await login(sourceClient, transferSourceEmail, LOGIN_PASSWORD);
  const folderJson = await assertJson(
    await sourceClient.post("/api/folders", {
      name: `transfer-folder-${Date.now()}`,
      description: "transfer test",
      visibility: "personal",
    }),
    "source folder create",
  );
  const sourceWorkflowJson = await assertJson(
    await sourceClient.post("/api/workflows", {
      title: `Transfer Workflow ${Date.now()}`,
      description: "transfer workflow",
      folder_id: folderJson.data.id,
      nodes: [
        {
          title: "Step",
          node_type: "action",
          instruction: "noop",
        },
      ],
    }),
    "source workflow create",
  );

  await assertJson(
    await admin.delete(`/api/users/${transferSourceId}`, {
      mode: "transfer",
      transfer_to: transferTargetId,
    }),
    "delete user transfer",
  );
  const transferredFolder = fetchDbValue(
    "SELECT owner_id FROM folders WHERE id = ?",
    [folderJson.data.id],
  );
  const transferredWorkflow = fetchDbValue(
    "SELECT owner_id FROM workflows WHERE id = ?",
    [sourceWorkflowJson.data.id],
  );
  if (transferredFolder?.owner_id !== transferTargetId) {
    throw new Error(`folder transfer failed: ${JSON.stringify(transferredFolder)}`);
  }
  if (transferredWorkflow?.owner_id !== transferTargetId) {
    throw new Error(`workflow transfer failed: ${JSON.stringify(transferredWorkflow)}`);
  }
  console.log("DELETE_USER_TRANSFER_OK");

  const deleteAllEmail = `delete-all-${Date.now()}@example.com`;
  const deleteAllJson = await assertJson(
    await admin.post("/api/users", {
      username: `delete-all-${Date.now()}`,
      email: deleteAllEmail,
      password: LOGIN_PASSWORD,
      role: "viewer",
    }),
    "create delete-all user",
  );
  const deleteAllId = deleteAllJson.data.id;

  await assertJson(
    await admin.delete(`/api/users/${deleteAllId}`, {
      mode: "delete_all",
    }),
    "delete user delete_all",
  );
  const deletedUser = fetchDbValue("SELECT id FROM users WHERE id = ?", [deleteAllId]);
  if (deletedUser) {
    throw new Error(`delete_all user still exists: ${JSON.stringify(deletedUser)}`);
  }
  console.log("DELETE_USER_DELETE_ALL_OK");

  console.log(
    JSON.stringify({
      success: true,
      targetUrl: TARGET_URL,
      sqlitePath: SQLITE_PATH,
      checks: [
        "cleanup-visual-html",
        "timeout-stale",
        "delete-user-transfer",
        "delete-user-delete-all",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(
    "TEST_FAILED",
    error && error.stack ? error.stack : String(error),
  );
  process.exitCode = 1;
});
