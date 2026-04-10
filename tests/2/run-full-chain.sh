#!/bin/bash
# BlueKiwi Full Chain E2E Test
# 브레인스토밍 체인 11 스텝 완주 + 서버 태스크 기록 검증
#
# Usage: bash tests/2/run-full-chain.sh

set -uo pipefail

SESSION="or-full-test"
LOGDIR="$(cd "$(dirname "$0")" && pwd)/logs-full"
WORKDIR="/Users/dante/workspace/dante-code/projects/OmegaRod"
API="http://localhost:3000/api"

mkdir -p "$LOGDIR"
rm -f "$LOGDIR"/*.txt

# ─── 유틸 ───
capture() {
  local file="$LOGDIR/${1}.txt"
  tmux capture-pane -t "$SESSION" -p -S -300 > "$file" 2>/dev/null
}

wait_for() {
  local pattern="$1" timeout="${2:-90}" elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if tmux capture-pane -t "$SESSION" -p -S -300 2>/dev/null | grep -qE "$pattern"; then
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  return 1
}

send() {
  tmux send-keys -t "$SESSION" "$1" Enter
}

press_enter() {
  tmux send-keys -t "$SESSION" Enter
}

press_down_enter() {
  # 방향키 아래 + 엔터 (AskUserQuestion에서 두 번째 옵션 선택)
  tmux send-keys -t "$SESSION" Down Enter
}

check_task() {
  # 서버에서 태스크 상태 조회하고 출력
  local task_id="$1"
  echo ""
  echo "  [SERVER] Task #$task_id 상태:"
  curl -s "$API/tasks/$task_id" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin).get('data', {})
    print(f'    Status: {d[\"status\"]} | Step: {d[\"current_step\"]} | Context: {d.get(\"context\",\"\")[:50]}')
    for l in d.get('logs', []):
        icon = {'completed':'✅','pending':'⏳','running':'🔄','cancelled':'❌','failed':'💥'}.get(l['status'],'?')
        out = (l.get('output','') or '')[:100].replace(chr(10),' ')
        vis = ' [HTML]' if l.get('visual_html') else ''
        web = f' [웹응답:{l[\"web_response\"][:30]}]' if l.get('web_response') else ''
        print(f'    {icon} Step {l[\"step_order\"]} [{l[\"status\"]:10s}] node#{l[\"node_id\"]}{vis}{web}: {out}')
except Exception as e:
    print(f'    Error: {e}')
" 2>/dev/null
}

log() {
  echo "[$(date +%H:%M:%S)] $1"
}

# ─── 사전 조건: DB 리셋 + Seed ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BlueKiwi Full Chain E2E"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

log "서버 + 데이터 확인..."
if ! curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
  log "❌ 웹서버가 실행되지 않았습니다. npm run dev를 먼저 실행하세요."
  exit 1
fi

# 체인이 있는지 확인, 없으면 seed
WF_COUNT=$(curl -s "$API/workflows" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo 0)
if [ "$WF_COUNT" -eq 0 ]; then
  log "워크플로가 없습니다. Seed 실행..."
  bash "$WORKDIR/scripts/seed-v2.sh" > /dev/null 2>&1
  log "✅ Seed 완료"
else
  log "✅ 기존 데이터 사용 (워크플로 ${WF_COUNT}개)"
fi

curl -s "$API/workflows" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d.get('data',[]):
    print(f'  Workflow #{c[\"id\"]}: {c[\"title\"]} ({len(c.get(\"nodes\",[]))} steps)')
" 2>/dev/null || echo "  (서버 조회 실패)"

echo ""

# ─── 기존 세션 정리 ───
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

# ─── Claude Code 시작 ───
log "Claude Code 시작..."
tmux new-session -d -s "$SESSION" -x 140 -y 50
tmux send-keys -t "$SESSION" "cd $WORKDIR && claude --dangerously-skip-permissions" Enter

log "초기화 대기 (20s)..."
sleep 20

# MCP 서버 로드 확인 — "1 MCP server failed" 가 나오면 재시작 필요
pane_init=$(tmux capture-pane -t "$SESSION" -p -S -50 2>/dev/null || echo "")
if echo "$pane_init" | grep -q "MCP server failed"; then
  log "⚠️ MCP 서버 로드 실패 감지. 세션 재시작..."
  tmux kill-session -t "$SESSION" 2>/dev/null
  sleep 2
  tmux new-session -d -s "$SESSION" -x 140 -y 50
  tmux send-keys -t "$SESSION" "cd $WORKDIR && claude --dangerously-skip-permissions" Enter
  sleep 20
fi

if ! wait_for "❯|Claude Code" 30; then
  log "❌ Claude Code 시작 실패"
  capture "00-fail"
  cat "$LOGDIR/00-fail.txt"
  tmux kill-session -t "$SESSION"
  exit 1
fi
log "✅ Claude Code 준비됨"
capture "00-init"

# ─── /or-start ───
log "━━━ /or-start 실행 ━━━"
send "/or-start 프로젝트 관리 도구 웹앱 신규 개발 브레인스토밍"

log "체인 선택 UI 대기..."
if wait_for "체인 선택|기능 브레인스토밍" 60; then
  log "✅ 체인 선택 UI 표시됨"
else
  log "⚠️ 체인 선택 UI 미감지 — Enter로 진행 시도"
fi
capture "01-chain-picker"

sleep 3
press_enter  # 첫 번째 옵션 (Recommended) 선택
log "체인 선택 완료. 태스크 생성 대기..."

if wait_for "Task #|or-next" 90; then
  log "✅ 태스크 생성 확인"
else
  log "⚠️ 태스크 생성 미감지"
fi
capture "02-task-created"

# 서버에서 태스크 ID 확인
TASK_ID=$(curl -s "$API/tasks?status=running" 2>/dev/null | python3 -c "
import sys, json
tasks = json.load(sys.stdin).get('data',[])
if tasks: print(tasks[0]['id'])
else: print('')
" 2>/dev/null)

if [ -z "$TASK_ID" ]; then
  log "❌ 서버에서 running 태스크를 찾을 수 없습니다"
  capture "02-no-task"
  tmux kill-session -t "$SESSION"
  exit 1
fi

log "Task #$TASK_ID 생성됨"
check_task "$TASK_ID"

# ─── /or-next 루프 (최대 11 스텝) ───
MAX_STEPS=25
for step in $(seq 1 $MAX_STEPS); do
  echo ""
  log "━━━ /or-next (Step $step/$MAX_STEPS) ━━━"
  send "/or-next"

  # 응답 대기 — Step 완료 또는 질문이 나올 때까지
  sleep 5

  # gate/loop 노드에서 AskUserQuestion이 나올 수 있음
  # 최대 90초 대기하면서 응답 확인
  waited=0
  while [ $waited -lt 90 ]; do
    pane=$(tmux capture-pane -t "$SESSION" -p -S -100 2>/dev/null || echo "")

    # AskUserQuestion picker가 나왔는지 확인 (방향키 선택 UI)
    if echo "$pane" | grep -qE "^❯|☐|☑"; then
      log "  AskUserQuestion 감지 → Enter"
      sleep 2
      press_enter
      sleep 5
      break
    fi

    # Step 완료 확인
    if echo "$pane" | grep -qE "Step.*완료|or-next.*실행|완료.*Task|finished"; then
      break
    fi

    # 에러 확인
    if echo "$pane" | grep -qE "활성 태스크가 없|Error|error"; then
      log "  ⚠️ 에러 감지"
      break
    fi

    sleep 5
    waited=$((waited + 5))
  done

  # 추가 AskUserQuestion 대기 (gate 노드 체인)
  sleep 5
  pane2=$(tmux capture-pane -t "$SESSION" -p -S -50 2>/dev/null || echo "")
  if echo "$pane2" | grep -qE "^❯|☐|☑"; then
    log "  추가 AskUserQuestion 감지 → Enter"
    sleep 1
    press_enter
    sleep 8
  fi

  capture "step-$(printf '%02d' $step)"

  # 서버 태스크 상태 확인
  check_task "$TASK_ID"

  # 체인 완료 확인
  TASK_STATUS=$(curl -s "$API/tasks/$TASK_ID" 2>/dev/null | python3 -c "
import sys, json
print(json.load(sys.stdin).get('data',{}).get('status',''))
" 2>/dev/null)

  if [ "$TASK_STATUS" = "completed" ]; then
    log "✅ 체인 완료!"
    break
  fi

  if [ "$TASK_STATUS" = "failed" ]; then
    log "❌ 체인 실패"
    break
  fi

  # 다음 스텝 전 잠시 대기
  sleep 3
done

# ─── 최종 결과 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
log "최종 결과"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

capture "99-final"
check_task "$TASK_ID"

# 전체 태스크 로그 요약
echo ""
echo "[SUMMARY] 태스크 로그 요약:"
curl -s "$API/tasks/$TASK_ID" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin).get('data', {})
logs = d.get('logs', [])
completed = sum(1 for l in logs if l.get('status') == 'completed')
pending = sum(1 for l in logs if l.get('status') == 'pending')
failed = sum(1 for l in logs if l.get('status') == 'failed')
cancelled = sum(1 for l in logs if l.get('status') == 'cancelled')
print(f'  총 로그: {len(logs)}')
print(f'  완료: {completed} | 대기: {pending} | 실패: {failed} | 취소: {cancelled}')
print(f'  태스크 상태: {d[\"status\"]}')
print(f'  현재 스텝: {d[\"current_step\"]}')
print(f'  컨텍스트: {d.get(\"context\",\"\")}')
" 2>/dev/null

echo ""
echo "[LOGS] 캡처 파일:"
ls "$LOGDIR"/*.txt 2>/dev/null | while read f; do
  echo "  $(basename "$f") ($(wc -c < "$f" | tr -d ' ') bytes)"
done

echo ""
echo "tmux 세션: tmux attach -t $SESSION"
echo "종료: tmux kill-session -t $SESSION"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
log "E2E 테스트 종료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
