#!/usr/bin/env bash
# OmegaRod E2E Workflow Test via REST API
# Runs a full workflow cycle using curl (MCP fallback)
# Usage: bash scripts/e2e-workflow.sh [chain_id] [api_key]

set -euo pipefail

API="${OMEGAROD_API_URL:-http://localhost:3000/api}"
CHAIN_ID="${1:-}"
API_KEY="${2:-${OMEGAROD_API_KEY:-}}"
AUTH=""
[ -n "$API_KEY" ] && AUTH="-H \"Authorization: Bearer $API_KEY\""

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    if [ -n "$API_KEY" ]; then
      curl -s -X "$method" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$body" "$API$path"
    else
      curl -s -X "$method" -H "Content-Type: application/json" -d "$body" "$API$path"
    fi
  else
    if [ -n "$API_KEY" ]; then
      curl -s -X "$method" -H "Authorization: Bearer $API_KEY" "$API$path"
    else
      curl -s -X "$method" "$API$path"
    fi
  fi
}

py() { python3 -c "import sys,json; d=json.load(sys.stdin); $1"; }

# ─── Select chain ───
if [ -z "$CHAIN_ID" ]; then
  bold "Available workflows:"
  api GET /chains | py "
for c in d['data']:
    print(f\"  [{c['id']}] {c['title']} (v{c['version']}, {len(c.get('nodes',[]))} steps)\")
"
  echo ""
  read -rp "Chain ID to run: " CHAIN_ID
fi

if [ -z "$CHAIN_ID" ]; then
  red "No chain selected."; exit 1
fi

# ─── Start ───
bold ""
bold "=== Starting workflow (chain_id=$CHAIN_ID) ==="
START=$(api POST /tasks/start "{\"chain_id\":$CHAIN_ID,\"context\":\"E2E test run\"}")

TASK_ID=$(echo "$START" | py "print(d['data']['task_id'])")
CHAIN_TITLE=$(echo "$START" | py "print(d['data']['chain_title'])")
TOTAL=$(echo "$START" | py "print(d['data']['total_steps'])")
VERSION=$(echo "$START" | py "print(d['data'].get('version','?'))")

green "Task $TASK_ID started: $CHAIN_TITLE v$VERSION ($TOTAL steps)"

NODE_ID=$(echo "$START" | py "print(d['data']['current_step']['node_id'])")
STEP_TITLE=$(echo "$START" | py "print(d['data']['current_step']['title'])")
STEP_TYPE=$(echo "$START" | py "print(d['data']['current_step']['node_type'])")
INSTRUCTION=$(echo "$START" | py "print(d['data']['current_step']['instruction'][:200])")

STEP=1
FINISHED="False"

while [ "$FINISHED" = "False" ]; do
  bold ""
  bold "--- Step $STEP/$TOTAL: $STEP_TITLE ($STEP_TYPE) ---"
  echo "  Instruction: ${INSTRUCTION}..."

  if [ "$STEP_TYPE" = "gate" ]; then
    echo ""
    read -rp "  [gate] Your input (or Enter to skip): " USER_INPUT
    OUTPUT="${USER_INPUT:-Gate approved by user.}"
  else
    OUTPUT="[E2E auto] Step $STEP ($STEP_TITLE) completed automatically."
  fi

  # Execute
  EXEC_BODY=$(python3 -c "
import json
body = {
    'node_id': $NODE_ID,
    'output': $(python3 -c "import json; print(json.dumps('$OUTPUT'))"),
    'status': 'completed',
    'structured_output': {
        'assistant_output': $(python3 -c "import json; print(json.dumps('$OUTPUT'))")
    },
    'model_id': 'e2e-test'
}
print(json.dumps(body))
")

  api POST "/tasks/$TASK_ID/execute" "$EXEC_BODY" > /dev/null
  green "  Step $STEP executed."

  # Advance
  ADV=$(api POST "/tasks/$TASK_ID/advance" "{}")
  FINISHED=$(echo "$ADV" | py "print(d['data'].get('finished', False))")

  if [ "$FINISHED" = "True" ]; then
    break
  fi

  NODE_ID=$(echo "$ADV" | py "print(d['data']['current_step']['node_id'])")
  STEP_TITLE=$(echo "$ADV" | py "print(d['data']['current_step']['title'])")
  STEP_TYPE=$(echo "$ADV" | py "print(d['data']['current_step']['node_type'])")
  INSTRUCTION=$(echo "$ADV" | py "print(d['data']['current_step']['instruction'][:200])")
  STEP=$((STEP + 1))
done

# Complete
api POST "/tasks/$TASK_ID/complete" '{"status":"completed","summary":"E2E test completed successfully."}' > /dev/null

bold ""
green "=== Workflow finished: $CHAIN_TITLE v$VERSION ==="
green "  Task ID: $TASK_ID"
green "  Steps completed: $STEP/$TOTAL"
green "  View: http://localhost:3000/tasks/$TASK_ID"
echo ""
