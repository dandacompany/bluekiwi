#!/usr/bin/env bash
# Sprint 1 Integration Tests
# Tests: A. Version System, B. Contract, C. Structured Output
# Requires: Next.js dev server on :3000, PostgreSQL on :5433

set -euo pipefail

API="http://localhost:3000/api"
PASS=0
FAIL=0
TOTAL=0

# ─── Helpers ───

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

assert_eq() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (expected=$expected, actual=$actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_empty() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" actual="$2"
  if [ -n "$actual" ] && [ "$actual" != "null" ]; then
    green "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (got empty/null)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    green "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (missing: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

DB_CMD="PGPASSWORD=bluekiwi_dev_2026 psql -h localhost -p 5433 -U bluekiwi -d bluekiwi -t -A"

db_query() {
  PGPASSWORD=bluekiwi_dev_2026 psql -h localhost -p 5433 -U bluekiwi -d bluekiwi -t -A -c "$1"
}

db_exec() {
  PGPASSWORD=bluekiwi_dev_2026 psql -h localhost -p 5433 -U bluekiwi -d bluekiwi -q -c "$1"
}

# ─── Cleanup ───

cleanup_workflow_id=""
cleanup_workflow_id2=""
cleanup_new_version_id=""
cleanup_contract_workflow_id=""
cleanup_task_id=""

cleanup() {
  [ -n "$cleanup_task_id" ] && db_exec "DELETE FROM tasks WHERE id = $cleanup_task_id;" 2>/dev/null || true
  [ -n "$cleanup_new_version_id" ] && curl -s -X DELETE "$API/workflows/$cleanup_new_version_id" >/dev/null 2>&1 || true
  [ -n "$cleanup_contract_workflow_id" ] && curl -s -X DELETE "$API/workflows/$cleanup_contract_workflow_id" >/dev/null 2>&1 || true
  [ -n "$cleanup_workflow_id2" ] && curl -s -X DELETE "$API/workflows/$cleanup_workflow_id2" >/dev/null 2>&1 || true
  [ -n "$cleanup_workflow_id" ] && curl -s -X DELETE "$API/workflows/$cleanup_workflow_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ═══════════════════════════════════════════════════
bold "═══ Sprint 1 Integration Tests ═══"
bold ""

# ═══════════════════════════════════════════════════
bold "── A. Version System ──"

# A1: Create workflow with default version
bold "A1: Create workflow with default version"
RESP=$(curl -s -X POST "$API/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TEST_VERSION_WORKFLOW",
    "description": "Sprint 1 test",
    "nodes": [
      {"title": "Step 1", "node_type": "action", "instruction": "Do step 1"},
      {"title": "Step 2", "node_type": "action", "instruction": "Do step 2"}
    ]
  }')

WORKFLOW_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
cleanup_workflow_id="$WORKFLOW_ID"
VERSION=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
assert_eq "default version is 1.0" "1.0" "$VERSION"
assert_not_empty "workflow_id created" "$WORKFLOW_ID"

# A2: Create workflow with explicit version
bold "A2: Create workflow with explicit version 2.0"
RESP2=$(curl -s -X POST "$API/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TEST_VERSION_WORKFLOW_V2",
    "description": "Explicit version test",
    "version": "2.0",
    "nodes": [
      {"title": "Step A", "node_type": "action", "instruction": "Do A"}
    ]
  }')

WORKFLOW_ID2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
cleanup_workflow_id2="$WORKFLOW_ID2"
VERSION2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
assert_eq "explicit version is 2.0" "2.0" "$VERSION2"

# A3: Version appears in GET list
bold "A3: Version in GET /workflows"
LIST_RESP=$(curl -s "$API/workflows")
HAS_VERSION=$(echo "$LIST_RESP" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
found = [c for c in data if c['id'] == $WORKFLOW_ID]
print(found[0].get('version','MISSING') if found else 'NOT_FOUND')
")
assert_eq "version in list response" "1.0" "$HAS_VERSION"

# A4: Version in GET /workflows/:id
bold "A4: Version in GET /workflows/:id"
DETAIL_RESP=$(curl -s "$API/workflows/$WORKFLOW_ID")
DETAIL_VERSION=$(echo "$DETAIL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
assert_eq "version in detail response" "1.0" "$DETAIL_VERSION"

# A5: PUT with create_new_version=true creates new workflow
bold "A5: PUT with create_new_version=true"
NEW_VER_RESP=$(curl -s -X PUT "$API/workflows/$WORKFLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "create_new_version": true,
    "nodes": [
      {"title": "Step 1 improved", "node_type": "action", "instruction": "Better step 1"},
      {"title": "Step 2 improved", "node_type": "action", "instruction": "Better step 2"},
      {"title": "Step 3 new", "node_type": "action", "instruction": "New step"}
    ]
  }')

NEW_WORKFLOW_ID=$(echo "$NEW_VER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
NEW_VERSION=$(echo "$NEW_VER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
NEW_PARENT=$(echo "$NEW_VER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('parent_workflow_id','null'))")
cleanup_new_version_id="$NEW_WORKFLOW_ID"

# New workflow should have different ID
if [ "$NEW_WORKFLOW_ID" != "$WORKFLOW_ID" ]; then
  TOTAL=$((TOTAL + 1)); green "  PASS: new version has different workflow_id"; PASS=$((PASS + 1))
else
  TOTAL=$((TOTAL + 1)); red "  FAIL: new version has different workflow_id (same ID)"; FAIL=$((FAIL + 1))
fi

assert_eq "new version is 1.1" "1.1" "$NEW_VERSION"
assert_eq "parent_workflow_id points to original" "$WORKFLOW_ID" "$NEW_PARENT"

# A6: Original workflow is unchanged
bold "A6: Original workflow unchanged after version creation"
ORIG_RESP=$(curl -s "$API/workflows/$WORKFLOW_ID")
ORIG_NODES=$(echo "$ORIG_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['nodes']))")
assert_eq "original still has 2 nodes" "2" "$ORIG_NODES"

echo ""

# ═══════════════════════════════════════════════════
bold "── B. Contract (Evaluation) System ──"

# B1: Create workflow with evaluation_contract
bold "B1: Create workflow with evaluation_contract"
CONTRACT_RESP=$(curl -s -X POST "$API/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TEST_CONTRACT_WORKFLOW",
    "description": "Contract test",
    "evaluation_contract": {
      "steps": {
        "1": {"min_output_length": 500, "required_sections": ["Background", "Goal"]},
        "2": {"min_output_length": 1000, "min_source_urls": 3}
      },
      "global": {
        "min_avg_output_length": 800,
        "require_all_context_snapshots": true
      }
    },
    "nodes": [
      {"title": "Research", "node_type": "action", "instruction": "Do research"},
      {"title": "Analysis", "node_type": "action", "instruction": "Analyze results"}
    ]
  }')

CONTRACT_WORKFLOW_ID=$(echo "$CONTRACT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
cleanup_contract_workflow_id="$CONTRACT_WORKFLOW_ID"
HAS_CONTRACT=$(echo "$CONTRACT_RESP" | python3 -c "
import sys,json
ec = json.load(sys.stdin)['data'].get('evaluation_contract')
print('true' if ec and 'steps' in ec else 'false')
")
assert_not_empty "contract workflow created" "$CONTRACT_WORKFLOW_ID"
assert_eq "evaluation_contract saved" "true" "$HAS_CONTRACT"

# B2: Contract appears in GET
bold "B2: Contract in GET /workflows/:id"
CONTRACT_GET=$(curl -s "$API/workflows/$CONTRACT_WORKFLOW_ID")
CONTRACT_MIN=$(echo "$CONTRACT_GET" | python3 -c "
import sys,json
ec = json.load(sys.stdin)['data']['evaluation_contract']
print(ec['steps']['1']['min_output_length'])
")
assert_eq "step 1 min_output_length is 500" "500" "$CONTRACT_MIN"

# B3: Update contract via PUT
bold "B3: Update contract via PUT"
curl -s -X PUT "$API/workflows/$CONTRACT_WORKFLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluation_contract": {
      "steps": {
        "1": {"min_output_length": 800}
      },
      "global": {
        "min_avg_output_length": 1000
      }
    }
  }' > /dev/null

CONTRACT_UPDATED=$(curl -s "$API/workflows/$CONTRACT_WORKFLOW_ID")
UPDATED_MIN=$(echo "$CONTRACT_UPDATED" | python3 -c "
import sys,json
ec = json.load(sys.stdin)['data']['evaluation_contract']
print(ec['steps']['1']['min_output_length'])
")
assert_eq "updated min_output_length is 800" "800" "$UPDATED_MIN"

echo ""

# ═══════════════════════════════════════════════════
bold "── C. Structured Output ──"

# C1: structured_output column exists in task_logs
bold "C1: structured_output column in task_logs"
COL_EXISTS=$(db_query "SELECT column_name FROM information_schema.columns WHERE table_name='task_logs' AND column_name='structured_output';")
assert_eq "structured_output column exists" "structured_output" "$COL_EXISTS"

# C2: Insert structured_output directly and verify
bold "C2: Direct DB structured_output insert/read"
TEST_TASK_ID=$(db_query "INSERT INTO tasks (workflow_id, status, current_step, context) VALUES ($WORKFLOW_ID, 'running', 1, 'test') RETURNING id;" | head -1 | tr -d '[:space:]')
cleanup_task_id="$TEST_TASK_ID"

FIRST_NODE_ID=$(db_query "SELECT id FROM workflow_nodes WHERE workflow_id = $WORKFLOW_ID ORDER BY step_order ASC LIMIT 1;" | head -1 | tr -d '[:space:]')

db_exec "INSERT INTO task_logs (task_id, node_id, step_order, status, output, node_title, node_type, structured_output)
    VALUES ($TEST_TASK_ID, $FIRST_NODE_ID, 1, 'completed', 'full output text',
            'Step 1', 'action',
            '{\"user_input\": \"test input\", \"thinking\": \"reasoning here\", \"assistant_output\": \"final result\"}'::jsonb);"

SO_READ=$(db_query "SELECT structured_output->>'assistant_output' FROM task_logs WHERE task_id = $TEST_TASK_ID AND step_order = 1 LIMIT 1;")
assert_eq "structured_output stored and read" "final result" "$SO_READ"

# C3: All three fields present
bold "C3: All structured_output fields"
SO_UI=$(db_query "SELECT structured_output->>'user_input' FROM task_logs WHERE task_id = $TEST_TASK_ID LIMIT 1;")
SO_TH=$(db_query "SELECT structured_output->>'thinking' FROM task_logs WHERE task_id = $TEST_TASK_ID LIMIT 1;")
SO_AO=$(db_query "SELECT structured_output->>'assistant_output' FROM task_logs WHERE task_id = $TEST_TASK_ID LIMIT 1;")
assert_eq "user_input value" "test input" "$SO_UI"
assert_eq "thinking value" "reasoning here" "$SO_TH"
assert_eq "assistant_output value" "final result" "$SO_AO"

echo ""

# ═══════════════════════════════════════════════════
bold "── D. Schema Integrity ──"

# D1: workflow_evaluations table exists
bold "D1: workflow_evaluations table"
EVAL_TABLE=$(db_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='workflow_evaluations';")
assert_eq "workflow_evaluations table exists" "1" "$EVAL_TABLE"

# D2: Indexes exist
bold "D2: New indexes"
IDX_COUNT=$(db_query "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_workflows_parent','idx_workflows_version','idx_workflow_evals_task','idx_workflow_evals_workflow');")
assert_eq "4 new indexes exist" "4" "$IDX_COUNT"

# D3: Existing workflows have default version
bold "D3: Existing data migration (default values)"
OLD_WORKFLOW_VERSION=$(db_query "SELECT version FROM workflows WHERE id = 1;")
assert_eq "existing workflow has default 1.0" "1.0" "$OLD_WORKFLOW_VERSION"

echo ""

# ═══════════════════════════════════════════════════
bold "═══ Results ═══"
echo ""
echo "  Total: $TOTAL  |  Pass: $PASS  |  Fail: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  red "Some tests failed!"
  exit 1
else
  green "All tests passed!"
  exit 0
fi
