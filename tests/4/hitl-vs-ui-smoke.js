import { chromium } from "playwright";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const TARGET_URL = process.env.TARGET_URL || "http://127.0.0.1:3510";
const SQLITE_PATH =
  process.env.SQLITE_PATH || "/tmp/bluekiwi-sqlite-smoke/data/bluekiwi.sqlite";
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || "sqlite-smoke@example.com";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "Passw0rd!";
const PW_HEADLESS = process.env.PW_HEADLESS !== "0";
const PW_SLOW_MO = Number(process.env.PW_SLOW_MO || "0");

const VS_HTML = `
<!-- @bk size=sm -->
<h2>Choose one option</h2>
<p class="bk-subtitle">Visual selection smoke test</p>
<div class="bk-options">
  <div class="bk-option" data-value="alpha" data-recommended>
    <div class="bk-option-letter">A</div>
    <div class="bk-option-body">
      <h3>Alpha</h3>
      <p>First option</p>
    </div>
  </div>
  <div class="bk-option" data-value="beta">
    <div class="bk-option-letter">B</div>
    <div class="bk-option-body">
      <h3>Beta</h3>
      <p>Second option</p>
    </div>
  </div>
</div>`;

function resetSqlitePassword(sqlitePath, email, password) {
  const resolved = path.resolve(sqlitePath);
  const db = new Database(resolved);
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?",
    )
    .run(hash, new Date().toISOString(), email);
  db.close();
  if (result.changes === 0) {
    throw new Error(`user not found for password reset: ${email}`);
  }
}

function canResetSqlitePassword(sqlitePath, email) {
  const resolved = path.resolve(sqlitePath);
  const db = new Database(resolved);
  try {
    const row = db
      .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
      .get(email);
    return Boolean(row?.id);
  } finally {
    db.close();
  }
}

async function ensureSetup(req) {
  const setupCheck = await assertOkJson(
    await req.get(`${TARGET_URL}/api/auth/setup`),
    "setup check",
  );
  if (!setupCheck.needsSetup) {
    return;
  }
  await assertOkJson(
    await req.post(`${TARGET_URL}/api/auth/setup`, {
      data: {
        username: "SQLite Smoke",
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
      },
    }),
    "initial setup",
  );
}

async function assertOkJson(response, label) {
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`${label} failed: ${response.status()} ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  const browser = await chromium.launch({
    headless: PW_HEADLESS,
    slowMo: PW_SLOW_MO,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const req = context.request;

  try {
    await ensureSetup(req);
    if (canResetSqlitePassword(SQLITE_PATH, LOGIN_EMAIL)) {
      resetSqlitePassword(SQLITE_PATH, LOGIN_EMAIL, LOGIN_PASSWORD);
    }

    await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL(`${TARGET_URL}/`, { timeout: 15000 });
    console.log("LOGIN_OK");

    const workflowJson = await assertOkJson(
      await req.post(`${TARGET_URL}/api/workflows`, {
        data: {
          title: `SQLite HITL VS Smoke ${Date.now()}`,
          description: "ui smoke for visual selection and hitl",
          nodes: [
            {
              title: "Visual Select Step",
              node_type: "gate",
              visual_selection: true,
              instruction: "show visual selector",
            },
            {
              title: "Approval Step",
              node_type: "action",
              hitl: true,
              instruction: "complete and wait for approval",
            },
          ],
        },
      }),
      "workflow create",
    );
    const workflow = workflowJson.data;
    const firstNode = workflow.nodes[0];
    const secondNode = workflow.nodes[1];
    console.log("WORKFLOW_OK", workflow.id, firstNode.id, secondNode.id);

    const taskJson = await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/start`, {
        data: {
          workflow_id: workflow.id,
          context: "ui smoke",
          title: "UI smoke task",
        },
      }),
      "task start",
    );
    const taskId = taskJson.data.task_id;
    console.log("TASK_OK", taskId);

    await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/${taskId}/visual`, {
        data: { node_id: firstNode.id, html: VS_HTML },
      }),
      "set visual html",
    );
    console.log("VISUAL_SET_OK");

    await page.goto(`${TARGET_URL}/tasks/${taskId}?step=1&vs=true`, {
      waitUntil: "networkidle",
    });
    const frame = page.frameLocator("iframe");
    await frame.locator('.bk-option[data-value="alpha"]').click();
    await frame.locator(".bk-vs-submit").click();
    await page.waitForTimeout(1200);

    const respondJson = await assertOkJson(
      await req.get(`${TARGET_URL}/api/tasks/${taskId}/respond`),
      "respond check",
    );
    const parsedResponse =
      typeof respondJson.data?.web_response === "string"
        ? JSON.parse(respondJson.data.web_response)
        : respondJson.data?.web_response;
    if (!parsedResponse?.selections?.includes("alpha")) {
      throw new Error(
        `visual selection response not persisted: ${JSON.stringify(respondJson)}`,
      );
    }
    console.log("VS_UI_OK");

    const exec1 = await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/${taskId}/execute`, {
        data: {
          node_id: firstNode.id,
          output: "visual step completed",
          status: "completed",
        },
      }),
      "step1 execute",
    );
    void exec1;

    await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/${taskId}/advance`, {
        data: {},
      }),
      "advance to step2",
    );
    console.log("STEP1_ADVANCE_OK");

    const exec2Json = await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/${taskId}/execute`, {
        data: {
          node_id: secondNode.id,
          output: "approval step completed awaiting approval",
          status: "completed",
        },
      }),
      "step2 execute",
    );
    if (exec2Json.data?.next_action !== "wait_for_human_approval") {
      throw new Error(
        `expected wait_for_human_approval, got ${JSON.stringify(exec2Json)}`,
      );
    }

    await assertOkJson(
      await req.post(`${TARGET_URL}/api/tasks/${taskId}/request-approval`, {
        data: { message: "please approve" },
      }),
      "request approval",
    );
    console.log("HITL_REQUEST_OK");

    await page.goto(`${TARGET_URL}/tasks/${taskId}?step=2`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=승인", { timeout: 10000 });
    await page.getByRole("button", { name: "승인" }).click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: "networkidle" });

    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes("승인 완료")) {
      throw new Error("approval completion banner not rendered");
    }
    console.log("HITL_UI_OK");

    console.log(
      JSON.stringify({
        success: true,
        targetUrl: TARGET_URL,
        sqlitePath: SQLITE_PATH,
        workflowId: workflow.id,
        taskId,
        checks: [
          "login",
          "visual-selection-submit",
          "visual-selection-persist",
          "hitl-request",
          "hitl-approve-ui",
        ],
      }),
    );
  } finally {
    await page.waitForTimeout(500);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    "TEST_FAILED",
    error && error.stack ? error.stack : String(error),
  );
  process.exitCode = 1;
});
