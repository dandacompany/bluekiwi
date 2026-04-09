#!/usr/bin/env bash
# Sprint 3 Integration Tests — REST API Fallback (MCP parity)
# Full workflow: start -> execute -> advance -> ... -> complete
# Requires: Next.js dev server on :3000, PostgreSQL on :5433

set -euo pipefail

API="http://localhost:3000/api"
PASS=0
FAIL=0
TOTAL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

assert_eq() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "  PASS: $desc"; PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (expected='$expected', actual='$actual')"; FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    green "  PASS: $desc"; PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (missing: $needle)"; FAIL=$((FAIL + 1))
  fi
}

assert_not_eq() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" unexpected="$2" actual="$3"
  if [ "$unexpected" != "$actual" ]; then
    green "  PASS: $desc"; PASS=$((PASS + 1))
  else
    red "  FAIL: $desc (got unexpected: $actual)"; FAIL=$((FAIL + 1))
  fi
}

db_exec() {
  PGPASSWORD=omegarod_dev_2026 psql -h localhost -p 5433 -U omegarod -d omegarod -q -c "$1"
}

TEST_CHAIN_ID=""
TEST_TASK_ID=""
TASK2_ID=""

cleanup() {
  for TID in "$TASK2_ID" "$TEST_TASK_ID"; do
    if [ -n "$TID" ]; then
      db_exec "DELETE FROM task_artifacts WHERE task_id = $TID;" 2>/dev/null || true
      db_exec "DELETE FROM task_logs WHERE task_id = $TID;" 2>/dev/null || true
      db_exec "DELETE FROM task_comments WHERE task_id = $TID;" 2>/dev/null || true
      db_exec "DELETE FROM tasks WHERE id = $TID;" 2>/dev/null || true
    fi
  done
  [ -n "$TEST_CHAIN_ID" ] && curl -s -X DELETE "$API/chains/$TEST_CHAIN_ID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

bold ""
bold "=== Sprint 3: REST API Fallback Tests ==="
bold ""

# -- Setup --
bold "-- Setup: Create test workflow --"
CHAIN_RESP=$(curl -s -X POST "$API/chains" \
  -H "Content-Type: application/json" \
  -d '{"title":"TEST_FALLBACK_WORKFLOW","description":"Sprint 3 test","evaluation_contract":{"steps":{"1":{"min_output_length":100}},"global":{"require_all_context_snapshots":true}},"nodes":[{"title":"Step 1: Research","node_type":"action","instruction":"Do research"},{"title":"Step 2: Analyze","node_type":"action","instruction":"Analyze results"},{"title":"Step 3: Report","node_type":"action","instruction":"Write report"}]}')
TEST_CHAIN_ID=$(echo "$CHAIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
assert_not_eq "chain created" "" "$TEST_CHAIN_ID"

echo ""

# === A. start ===
bold "-- A. POST /tasks/start --"

START_RESP=$(curl -s -X POST "$API/tasks/start" \
  -H "Content-Type: application/json" \
  -d "{\"chain_id\":$TEST_CHAIN_ID,\"context\":\"test ctx\"}")

TEST_TASK_ID=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['task_id'])")
assert_not_eq "task_id" "" "$TEST_TASK_ID"

CT=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['chain_title'])")
assert_eq "chain_title" "TEST_FALLBACK_WORKFLOW" "$CT"

TS=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['total_steps'])")
assert_eq "total_steps=3" "3" "$TS"

S1=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['title'])")
assert_eq "step1 title" "Step 1: Research" "$S1"

NODE1=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['node_id'])")

EC=$(echo "$START_RESP" | python3 -c "import sys,json; print('yes' if json.load(sys.stdin)['data'].get('evaluation_contract') else 'no')")
assert_eq "has contract" "yes" "$EC"

VER=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
assert_eq "version" "1.0" "$VER"

ERR=$(curl -s -X POST "$API/tasks/start" -H "Content-Type: application/json" \
  -d '{"chain_id":99999}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "bad chain" "NOT_FOUND" "$ERR"

echo ""

# === B. execute ===
bold "-- B. POST /tasks/:id/execute --"

EXEC=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{\"node_id\":$NODE1,\"output\":\"Research done. 5 insights.\",\"status\":\"completed\",\"context_snapshot\":\"{\\\"findings\\\":5}\",\"structured_output\":{\"user_input\":\"Research AI\",\"thinking\":\"Analyzing...\",\"assistant_output\":\"Done.\"},\"model_id\":\"claude-opus-4-6\"}")

OK=$(echo "$EXEC" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['success'])")
assert_eq "execute ok" "True" "$OK"

ERR=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{"node_id":99999,"output":"x","status":"completed"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "bad node" "NOT_FOUND" "$ERR"

echo ""

# === C. advance ===
bold "-- C. POST /tasks/:id/advance --"

PEEK=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/advance" \
  -H "Content-Type: application/json" -d '{"peek":true}')
PS=$(echo "$PEEK" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step'])")
assert_eq "peek=step1" "1" "$PS"

ADV=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/advance" \
  -H "Content-Type: application/json" -d '{}')
FN=$(echo "$ADV" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['finished'])")
assert_eq "not finished" "False" "$FN"

S2=$(echo "$ADV" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['title'])")
assert_eq "step2" "Step 2: Analyze" "$S2"
NODE2=$(echo "$ADV" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['node_id'])")

ERR=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/advance" \
  -H "Content-Type: application/json" -d '{}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "cant advance" "PRECONDITION_FAILED" "$ERR"

echo ""

# === D. heartbeat ===
bold "-- D. POST /tasks/:id/heartbeat --"

HB=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"node_id\":$NODE2,\"progress\":\"50%\"}")
HO=$(echo "$HB" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['success'])")
assert_eq "heartbeat ok" "True" "$HO"

echo ""

# === E. Full flow to finish ===
bold "-- E. Execute+Advance to finish --"

curl -s -X POST "$API/tasks/$TEST_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{\"node_id\":$NODE2,\"output\":\"Analysis done.\",\"status\":\"completed\"}" > /dev/null

ADV3=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/advance" \
  -H "Content-Type: application/json" -d '{}')
S3=$(echo "$ADV3" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['title'])")
assert_eq "step3" "Step 3: Report" "$S3"
NODE3=$(echo "$ADV3" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['node_id'])")

curl -s -X POST "$API/tasks/$TEST_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{\"node_id\":$NODE3,\"output\":\"Report written.\",\"status\":\"completed\"}" > /dev/null

FIN=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/advance" \
  -H "Content-Type: application/json" -d '{}')
FD=$(echo "$FIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['finished'])")
assert_eq "finished" "True" "$FD"

echo ""

# === F. rewind ===
bold "-- F. POST /tasks/:id/rewind --"

START2=$(curl -s -X POST "$API/tasks/start" \
  -H "Content-Type: application/json" \
  -d "{\"chain_id\":$TEST_CHAIN_ID}")
TASK2_ID=$(echo "$START2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['task_id'])")
N1=$(echo "$START2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['node_id'])")

curl -s -X POST "$API/tasks/$TASK2_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{\"node_id\":$N1,\"output\":\"Done.\",\"status\":\"completed\"}" > /dev/null
curl -s -X POST "$API/tasks/$TASK2_ID/advance" \
  -H "Content-Type: application/json" -d '{}' > /dev/null

RW=$(curl -s -X POST "$API/tasks/$TASK2_ID/rewind" \
  -H "Content-Type: application/json" -d '{"to_step":1}')
RS=$(echo "$RW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['rewound_to'])")
assert_eq "rewound" "1" "$RS"

RT=$(echo "$RW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['title'])")
assert_eq "rewind title" "Step 1: Research" "$RT"

RI=$(echo "$RW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current_step']['instruction'])")
assert_contains "rewind instruction" "$RI" "research"

ERR=$(curl -s -X POST "$API/tasks/$TASK2_ID/rewind" \
  -H "Content-Type: application/json" -d '{"to_step":99}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('code','X'))")
assert_eq "bad rewind" "NOT_FOUND" "$ERR"

echo ""

# === G. complete ===
bold "-- G. POST /tasks/:id/complete --"

CO=$(curl -s -X POST "$API/tasks/$TEST_TASK_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","summary":"All done."}')
CS=$(echo "$CO" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
assert_eq "complete status" "completed" "$CS"

SC=$(echo "$CO" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['steps_completed'])")
assert_eq "steps=3" "3" "$SC"

echo ""

# === H. Route existence ===
bold "-- H. Route existence --"

for EP in "tasks/start" "tasks/1/execute" "tasks/1/advance" "tasks/1/complete" "tasks/1/heartbeat" "tasks/1/rewind"; do
  SC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/$EP" -H "Content-Type: application/json" -d '{}')
  if [ "$SC" != "404" ]; then
    TOTAL=$((TOTAL + 1)); green "  PASS: /api/$EP exists ($SC)"; PASS=$((PASS + 1))
  else
    TOTAL=$((TOTAL + 1)); red "  FAIL: /api/$EP 404"; FAIL=$((FAIL + 1))
  fi
done

echo ""

# === Results ===
bold "=== Results ==="
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
