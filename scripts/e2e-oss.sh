#!/usr/bin/env bash
# scripts/e2e-oss.sh — BlueKiwi OSS end-to-end smoke test.
# Covers S1-S6: superuser setup, invite+CLI, workflow CRUD,
# task execution, RBAC, and MCP tools.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Configuration ────────────────────────────────────────────────────────────
BLUEKIWI_EXTERNAL="${BLUEKIWI_EXTERNAL:-0}"
BLUEKIWI_API_URL="${BLUEKIWI_API_URL:-http://localhost:3100}"
SCENARIOS="${SCENARIOS:-S1,S2,S3,S4,S5,S6}"

ADMIN_EMAIL="e2e-admin@test.local"
ADMIN_PASSWORD="e2e-admin-1234"
ADMIN_USERNAME="e2eadmin"

INVITEE_EMAIL="e2e-invitee@test.local"
INVITEE_USERNAME="e2eguest"
INVITEE_PASSWORD="e2e-guest-1234"

VIEWER_EMAIL="e2e-viewer@test.local"
VIEWER_USERNAME="e2eviewer"
VIEWER_PASSWORD="e2e-viewer-1234"

SANDBOX_HOME="$(mktemp -d -t bluekiwi-e2e-home.XXXXXX)"
COOKIE_JAR="$(mktemp)"

PASS=0
FAIL=0
declare -A TIMES

# ── Shared state (populated by S1, used by later scenarios) ──────────────────
API_KEY=""
INVITE_TOKEN=""
VIEWER_API_KEY=""
WF_ID=""
TASK_ID=""

# ── Utility functions ─────────────────────────────────────────────────────────
log()  { echo "[e2e] $*"; }
pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }

# HTTP helpers (use cookie jar for session)
GET()  { curl -sf -b "$COOKIE_JAR" -X GET  -H "Content-Type: application/json" "${BLUEKIWI_API_URL}$1"; }
POST() { curl -sf -b "$COOKIE_JAR" -X POST -H "Content-Type: application/json" "${BLUEKIWI_API_URL}$1" "${@:2}"; }

# AUTH: method path token [extra curl args...]
# Example: AUTH POST /api/workflows "$API_KEY" -d '{"title":"..."}'
AUTH() {
  local method="$1"
  local path="$2"
  local token="$3"
  shift 3
  curl -sf -X "$method" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    "${BLUEKIWI_API_URL}${path}" "$@"
}

# Read stdin JSON and evaluate a JS property expression via node
# Usage: echo '{"a":1}' | jq_val '.a'
jq_val() {
  node -p "JSON.parse(require('fs').readFileSync(0,'utf8'))$1"
}

# Run a scenario function, time it, update PASS/FAIL
run_scenario() {
  local name="$1"
  local fn="$2"
  log "Running $name..."
  local start
  start=$(node -e "process.stdout.write(String(Date.now()))")
  if "$fn"; then
    local elapsed=$(( $(node -e "process.stdout.write(String(Date.now()))") - start ))
    TIMES["$name"]=$elapsed
    log "$name PASSED (${elapsed}ms)"
    PASS=$(( PASS + 1 ))
  else
    local elapsed=$(( $(node -e "process.stdout.write(String(Date.now()))") - start ))
    TIMES["$name"]=$elapsed
    log "$name FAILED (${elapsed}ms)" >&2
    FAIL=$(( FAIL + 1 ))
  fi
}

# Check if a scenario is in the SCENARIOS list
should_run() {
  local name="$1"
  [[ ",$SCENARIOS," == *",$name,"* ]]
}

# ── Lifecycle ─────────────────────────────────────────────────────────────────
cleanup() {
  if [[ "$BLUEKIWI_EXTERNAL" == "0" ]]; then
    log "Stopping docker stack..."
    docker compose down -v >/dev/null 2>&1 || true
  fi
  rm -rf "$SANDBOX_HOME" || true
  rm -f "$COOKIE_JAR" || true
}
trap cleanup EXIT

start_stack() {
  if [[ "$BLUEKIWI_EXTERNAL" == "1" ]]; then
    log "BLUEKIWI_EXTERNAL=1 — skipping docker stack"
    return
  fi

  if [[ ! -f .env ]]; then
    log "Generating .env..."
    {
      echo "DB_PASSWORD=$(openssl rand -hex 16)"
      echo "JWT_SECRET=$(openssl rand -hex 32)"
      echo "APP_PORT=3100"
      echo "PUBLIC_URL=${BLUEKIWI_API_URL}"
      echo "BLUEKIWI_VERSION=${BLUEKIWI_VERSION:-latest}"
    } > .env
  fi

  log "Starting docker compose stack..."
  docker compose up -d

  log "Waiting for server (up to 60s)..."
  local i
  for i in $(seq 1 30); do
    if curl -sf -o /dev/null "${BLUEKIWI_API_URL}/"; then
      log "Server is up."
      return
    fi
    sleep 2
  done
  echo "Server did not become ready in 60s" >&2
  exit 1
}

# ── S1: superuser_setup ───────────────────────────────────────────────────────
s1_superuser_setup() {
  # 1. First setup → must succeed and return role=superuser
  local setup_resp
  setup_resp=$(POST /api/auth/setup \
    -d "{\"username\":\"${ADMIN_USERNAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  local role
  role=$(echo "$setup_resp" | jq_val '.data.role')
  [[ "$role" == "superuser" ]] || fail "setup: expected role=superuser, got $role"
  pass "setup returned role=superuser"

  # 2. Login (save cookie)
  curl -sf -c "$COOKIE_JAR" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "${BLUEKIWI_API_URL}/api/auth/login" > /dev/null
  pass "login successful"

  # 3. Mint API key
  local key_resp
  key_resp=$(POST /api/apikeys -d '{"name":"e2e"}')
  API_KEY=$(echo "$key_resp" | jq_val '.data.plaintext')
  [[ -z "$API_KEY" || "$API_KEY" == "undefined" ]] && fail "failed to mint API key"
  [[ "$API_KEY" == bk_* ]] || fail "API key does not start with bk_: $API_KEY"
  pass "API key minted: ${API_KEY:0:12}..."

  # 4. Second setup → must return 409
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin2\",\"email\":\"admin2@test.local\",\"password\":\"pass1234\"}" \
    "${BLUEKIWI_API_URL}/api/auth/setup")
  [[ "$http_code" == "409" ]] || fail "second setup: expected 409, got $http_code"
  pass "second setup returns 409"
}

# ── S2: invite_cli ────────────────────────────────────────────────────────────
s2_invite_cli() {
  # 1. Create invite (editor role)
  local inv_resp
  inv_resp=$(AUTH POST /api/invites "$API_KEY" \
    -d "{\"email\":\"${INVITEE_EMAIL}\",\"role\":\"editor\"}")
  INVITE_TOKEN=$(echo "$inv_resp" | jq_val '.data.token')
  [[ -z "$INVITE_TOKEN" || "$INVITE_TOKEN" == "undefined" ]] && fail "failed to get invite token"
  pass "invite token obtained"

  # 2. Build CLI
  log "Building CLI..."
  ( cd packages/cli && npm run build >/dev/null 2>&1 )
  pass "CLI built"

  # 3. Accept invite via CLI in sandboxed HOME
  HOME="$SANDBOX_HOME" node packages/cli/dist/index.js accept "$INVITE_TOKEN" \
    --server "${BLUEKIWI_API_URL}" <<STDIN
${INVITEE_USERNAME}
${INVITEE_PASSWORD}

STDIN
  pass "CLI accept completed"

  # 4. Config file must exist
  [[ -f "${SANDBOX_HOME}/.bluekiwi/config.json" ]] || fail "config.json not found"
  pass "config.json exists"

  # 5. server_url must match
  local saved_url
  saved_url=$(node -p "JSON.parse(require('fs').readFileSync('${SANDBOX_HOME}/.bluekiwi/config.json','utf8')).server_url")
  [[ "$saved_url" == "$BLUEKIWI_API_URL" ]] || fail "server_url mismatch: $saved_url"
  pass "server_url matches"

  # 6. bluekiwi status → "Connected"
  local status_out
  status_out=$(HOME="$SANDBOX_HOME" node packages/cli/dist/index.js status 2>&1)
  echo "$status_out" | grep -q "Connected" || fail "status did not contain 'Connected': $status_out"
  pass "status shows Connected"
}

# ── S3: workflow_crud ─────────────────────────────────────────────────────────
s3_workflow_crud() {
  # 1. Create workflow
  local wf_resp
  wf_resp=$(AUTH POST /api/workflows "$API_KEY" \
    -d '{"title":"e2e-test-workflow","nodes":[{"title":"step1","instruction":"do something","node_type":"action"}]}')
  WF_ID=$(echo "$wf_resp" | jq_val '.data.id')
  [[ -z "$WF_ID" || "$WF_ID" == "undefined" || "$WF_ID" == "null" ]] && fail "workflow create: no id"
  pass "workflow created id=$WF_ID"

  # 2. GET workflow
  local get_resp
  get_resp=$(AUTH GET "/api/workflows/${WF_ID}" "$API_KEY")
  local got_title
  got_title=$(echo "$get_resp" | jq_val '.data.title')
  [[ "$got_title" == "e2e-test-workflow" ]] || fail "GET workflow: title mismatch: $got_title"
  pass "GET workflow OK"

  # 3. PUT (rename + create_version)
  local put_resp
  put_resp=$(AUTH PUT "/api/workflows/${WF_ID}" "$API_KEY" \
    -d '{"title":"e2e-test-workflow-v2","create_version":true}')
  WF_ID=$(echo "$put_resp" | jq_val '.data.id')
  [[ -z "$WF_ID" || "$WF_ID" == "undefined" || "$WF_ID" == "null" ]] && fail "PUT workflow: no id"
  pass "PUT workflow → new id=$WF_ID"

  # 4. DELETE
  local del_code
  del_code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Authorization: Bearer $API_KEY" \
    "${BLUEKIWI_API_URL}/api/workflows/${WF_ID}")
  [[ "$del_code" == "200" || "$del_code" == "204" ]] || fail "DELETE workflow: expected 200/204, got $del_code"
  pass "DELETE workflow OK ($del_code)"

  # 5. GET deleted → 404
  local gone_code
  gone_code=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    -H "Authorization: Bearer $API_KEY" \
    "${BLUEKIWI_API_URL}/api/workflows/${WF_ID}")
  [[ "$gone_code" == "404" ]] || fail "GET deleted workflow: expected 404, got $gone_code"
  pass "GET deleted workflow → 404"

  # 6. Create workflow for S4
  local run_wf_resp
  run_wf_resp=$(AUTH POST /api/workflows "$API_KEY" \
    -d '{"title":"e2e-run-workflow","nodes":[{"title":"run-step","instruction":"execute this","node_type":"action"}]}')
  WF_ID=$(echo "$run_wf_resp" | jq_val '.data.id')
  [[ -z "$WF_ID" || "$WF_ID" == "undefined" || "$WF_ID" == "null" ]] && fail "create run-workflow: no id"
  pass "run-workflow created id=$WF_ID"
}

# ── S4: task_execution ────────────────────────────────────────────────────────
s4_task_execution() {
  # 1. Start task
  local start_resp
  start_resp=$(AUTH POST /api/tasks/start "$API_KEY" \
    -d "{\"workflow_id\":${WF_ID},\"title\":\"e2e run\"}")
  TASK_ID=$(echo "$start_resp" | jq_val '.data.task_id')
  [[ -z "$TASK_ID" || "$TASK_ID" == "undefined" || "$TASK_ID" == "null" ]] && fail "task start: no task_id"
  local node_id
  node_id=$(echo "$start_resp" | jq_val '.data.current_step.node_id')
  pass "task started id=$TASK_ID node_id=$node_id"

  # 2. Execute step (structured_output)
  AUTH POST "/api/tasks/${TASK_ID}/execute" "$API_KEY" \
    -d "{\"node_id\":${node_id},\"output\":\"e2e output\",\"status\":\"completed\",\"structured_output\":{\"user_input\":\"test input\",\"thinking\":\"test think\",\"assistant_output\":\"test out\"}}" \
    > /dev/null
  pass "execute step OK"

  # 3. Advance
  AUTH POST "/api/tasks/${TASK_ID}/advance" "$API_KEY" \
    -d '{}' > /dev/null || true
  pass "advance OK"

  # 4. Complete
  AUTH POST "/api/tasks/${TASK_ID}/complete" "$API_KEY" \
    -d '{"status":"completed","summary":"e2e done"}' > /dev/null
  pass "complete OK"

  # 5. GET task → status=completed
  local task_resp
  task_resp=$(AUTH GET "/api/tasks/${TASK_ID}" "$API_KEY")
  local task_status
  task_status=$(echo "$task_resp" | jq_val '.data.status')
  [[ "$task_status" == "completed" ]] || fail "task status: expected completed, got $task_status"
  pass "task status=completed"

  # 6. logs[0].structured_output not null
  local so
  so=$(echo "$task_resp" | jq_val '.data.logs[0].structured_output')
  [[ -z "$so" || "$so" == "null" || "$so" == "undefined" ]] && fail "logs[0].structured_output is null"
  pass "logs[0].structured_output present"
}

# ── S5: rbac ──────────────────────────────────────────────────────────────────
s5_rbac() {
  local viewer_sandbox
  viewer_sandbox="$(mktemp -d -t bluekiwi-e2e-viewer.XXXXXX)"

  # 1. Create viewer invite
  local vinv_resp
  vinv_resp=$(AUTH POST /api/invites "$API_KEY" \
    -d "{\"email\":\"${VIEWER_EMAIL}\",\"role\":\"viewer\"}")
  local viewer_token
  viewer_token=$(echo "$vinv_resp" | jq_val '.data.token')
  [[ -z "$viewer_token" || "$viewer_token" == "undefined" ]] && fail "viewer invite: no token"
  pass "viewer invite token obtained"

  # 2. CLI accept in viewer_sandbox
  HOME="$viewer_sandbox" node packages/cli/dist/index.js accept "$viewer_token" \
    --server "${BLUEKIWI_API_URL}" <<VSTDIN
${VIEWER_USERNAME}
${VIEWER_PASSWORD}

VSTDIN
  pass "viewer CLI accept completed"

  # 3. Load viewer API key from config
  VIEWER_API_KEY=$(node -p \
    "JSON.parse(require('fs').readFileSync('${viewer_sandbox}/.bluekiwi/config.json','utf8')).api_key")
  [[ -z "$VIEWER_API_KEY" || "$VIEWER_API_KEY" == "undefined" || "$VIEWER_API_KEY" == "null" ]] && \
    fail "viewer config.json has no api_key"
  pass "viewer API key loaded: ${VIEWER_API_KEY:0:12}..."

  # 4. viewer POST /api/workflows → 403
  local create_code
  create_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $VIEWER_API_KEY" \
    -d '{"title":"should-fail","nodes":[]}' \
    "${BLUEKIWI_API_URL}/api/workflows")
  [[ "$create_code" == "403" ]] || fail "viewer POST workflows: expected 403, got $create_code"
  pass "viewer POST workflows → 403"

  # 5. viewer GET /api/workflows → 200
  local list_code
  list_code=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    -H "Authorization: Bearer $VIEWER_API_KEY" \
    "${BLUEKIWI_API_URL}/api/workflows")
  [[ "$list_code" == "200" ]] || fail "viewer GET workflows: expected 200, got $list_code"
  pass "viewer GET workflows → 200"

  # 6. Find viewer's first non-revoked API key id (via admin endpoint)
  local viewer_keys_resp
  viewer_keys_resp=$(AUTH GET /api/apikeys "$API_KEY")
  local viewer_key_id
  viewer_key_id=$(node -p "
    const keys = JSON.parse(require('fs').readFileSync(0,'utf8')).data;
    const found = Array.isArray(keys) && keys.find(k => !k.is_revoked && k.prefix && '$VIEWER_API_KEY'.startsWith(k.prefix));
    found ? String(found.id) : 'not_found'
  " <<< "$viewer_keys_resp")
  [[ "$viewer_key_id" == "not_found" || -z "$viewer_key_id" ]] && fail "could not find viewer key id in apikeys list"
  pass "viewer key id=$viewer_key_id"

  # 7. Admin DELETE viewer's key
  local revoke_code
  revoke_code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Authorization: Bearer $API_KEY" \
    "${BLUEKIWI_API_URL}/api/apikeys/${viewer_key_id}")
  [[ "$revoke_code" == "200" || "$revoke_code" == "204" ]] || fail "admin revoke viewer key: expected 200/204, got $revoke_code"
  pass "admin revoked viewer key ($revoke_code)"

  # 8. viewer GET with revoked key → 401
  local revoked_code
  revoked_code=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    -H "Authorization: Bearer $VIEWER_API_KEY" \
    "${BLUEKIWI_API_URL}/api/workflows")
  [[ "$revoked_code" == "401" ]] || fail "viewer GET with revoked key: expected 401, got $revoked_code"
  pass "viewer GET with revoked key → 401"

  rm -rf "$viewer_sandbox" || true
}

# ── S6: mcp_tools ─────────────────────────────────────────────────────────────
s6_mcp_tools() {
  # 1. Build MCP server
  log "Building MCP server..."
  ( cd mcp && npm run build >/dev/null 2>&1 )
  pass "MCP server built"

  # 2. list_workflows via stdio
  local list_req
  list_req='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_workflows","arguments":{}}}'
  local list_resp
  list_resp=$(echo "$list_req" | \
    BLUEKIWI_API_URL="$BLUEKIWI_API_URL" BLUEKIWI_API_KEY="$API_KEY" \
    node mcp/dist/server.js 2>/dev/null | head -1)
  echo "$list_resp" | grep -q '"result"' || fail "MCP list_workflows: no 'result' in response: $list_resp"
  pass "MCP list_workflows OK"

  # 3. start_workflow via stdio
  local start_req
  start_req="{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"start_workflow\",\"arguments\":{\"workflow_id\":${WF_ID}}}}"
  local start_resp
  start_resp=$(echo "$start_req" | \
    BLUEKIWI_API_URL="$BLUEKIWI_API_URL" BLUEKIWI_API_KEY="$API_KEY" \
    node mcp/dist/server.js 2>/dev/null | head -1)
  echo "$start_resp" | grep -q '"result"' || fail "MCP start_workflow: no 'result' in response: $start_resp"
  pass "MCP start_workflow OK"
}

# ── Main ──────────────────────────────────────────────────────────────────────
start_stack

should_run S1 && run_scenario "S1" s1_superuser_setup
should_run S2 && run_scenario "S2" s2_invite_cli
should_run S3 && run_scenario "S3" s3_workflow_crud
should_run S4 && run_scenario "S4" s4_task_execution
should_run S5 && run_scenario "S5" s5_rbac
should_run S6 && run_scenario "S6" s6_mcp_tools

echo ""
echo "─────────────────────────────────────────"
total=$(( PASS + FAIL ))
echo "${PASS}/${total} passed"
for name in "${!TIMES[@]}"; do
  printf "  [%s] %dms\n" "$name" "${TIMES[$name]}"
done | sort
[[ "$FAIL" -eq 0 ]] || exit 1
echo "✓ BlueKiwi OSS E2E passed"
