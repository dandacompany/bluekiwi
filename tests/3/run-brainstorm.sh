#!/bin/bash
# BlueKiwi E2E Test — 기능 브레인스토밍 전체 흐름 (격리 환경)
# 작업 디렉토리: tests/3/ (BlueKiwi 프로젝트와 격리)
#
# Usage: bash tests/3/run-brainstorm.sh

set -uo pipefail

SESSION="or-brainstorm"
LOGDIR="$(cd "$(dirname "$0")" && pwd)/logs"
WORKDIR="$(cd "$(dirname "$0")" && pwd)"
OR_ROOT="/Users/dante/workspace/dante-code/projects/OmegaRod"
API="http://localhost:3000/api"
MAX_ROUNDS=25

mkdir -p "$LOGDIR"
rm -f "$LOGDIR"/*.txt

# ─── 유틸 ───
capture() { tmux capture-pane -t "$SESSION" -p -S -300 > "$LOGDIR/${1}.txt" 2>/dev/null; }
wait_for() {
  local pattern="$1" timeout="${2:-90}" elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if tmux capture-pane -t "$SESSION" -p -S -300 2>/dev/null | grep -qE "$pattern"; then return 0; fi
    sleep 3; elapsed=$((elapsed + 3))
  done
  return 1
}
send() { tmux send-keys -t "$SESSION" "$1" Enter; }
press_enter() { tmux send-keys -t "$SESSION" Enter; }
log() { echo "[$(date +%H:%M:%S)] $1"; }

check_task() {
  local task_id="$1"
  curl -s "$API/tasks/$task_id" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin).get('data', {})
    print(f'    Task #{d[\"id\"]}: {d[\"status\"]} | Step {d[\"current_step\"]} | ctx: {d.get(\"context\",\"\")[:40]}')
    for l in d.get('logs', []):
        icon = {'completed':'✅','pending':'⏳','running':'🔄','cancelled':'❌','failed':'💥'}.get(l['status'],'?')
        out = (l.get('output','') or '')[:120].replace(chr(10),' ')
        print(f'    {icon} Step {l[\"step_order\"]} [{l[\"status\"]:10s}]: {out}')
except Exception as e:
    print(f'    Error: {e}')
" 2>/dev/null
}

# ─── 사전 조건 ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BlueKiwi Brainstorm E2E"
echo "작업 디렉토리: $WORKDIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

log "서버 확인..."
curl -s "$API/workflows" | python3 -c "
import sys, json
for c in json.load(sys.stdin).get('data',[]):
    print(f'  Chain #{c[\"id\"]}: {c[\"title\"]} ({len(c.get(\"nodes\",[]))} steps)')
" 2>/dev/null

# ─── 세션 시작 ───
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

log "Claude Code 시작 (격리 디렉토리: tests/3/)..."
tmux new-session -d -s "$SESSION" -x 140 -y 50
# tests/3/ 디렉토리에서 Claude 시작 — BlueKiwi 프로젝트와 격리
tmux send-keys -t "$SESSION" "cd $WORKDIR && claude --dangerously-skip-permissions" Enter

log "초기화 대기 (20s)..."
sleep 20

# MCP 실패 체크
pane=$(tmux capture-pane -t "$SESSION" -p -S -50 2>/dev/null || echo "")
if echo "$pane" | grep -q "MCP server failed"; then
  log "⚠️ MCP 실패. BlueKiwi 디렉토리에서 재시작..."
  tmux kill-session -t "$SESSION" 2>/dev/null; sleep 1
  tmux new-session -d -s "$SESSION" -x 140 -y 50
  tmux send-keys -t "$SESSION" "cd $OR_ROOT && claude --dangerously-skip-permissions" Enter
  sleep 20
fi

if ! wait_for "❯|Claude Code" 30; then
  log "❌ Claude Code 시작 실패"; capture "00-fail"; exit 1
fi
log "✅ Claude Code 준비됨"
capture "00-init"

# ─── /or-start ───
log "━━━ /or-start 실행 ━━━"
send "/or-start 프로젝트 관리 도구 웹앱 신규 개발 브레인스토밍"

# /or-start가 첫 단계를 즉시 실행하므로 충분히 대기
log "체인 선택 + 첫 단계 실행 대기..."
sleep 10

# AskUserQuestion picker가 나왔으면 Enter
if tmux capture-pane -t "$SESSION" -p -S -50 2>/dev/null | grep -qE "^❯|☐|체인 선택"; then
  log "  체인 선택 UI → Enter"
  press_enter
  sleep 5
fi

# 충분히 대기 — 첫 단계(action: 컨텍스트 분석)가 실행됨
if wait_for "단계 완료|or-next|다음 단계" 120; then
  log "✅ 첫 단계 실행 완료"
else
  log "⚠️ 첫 단계 완료 미감지 — 진행 시도"
fi
capture "01-start-done"

# 태스크 확인
TASK_ID=$(curl -s "$API/tasks?status=running" 2>/dev/null | python3 -c "
import sys, json
tasks = json.load(sys.stdin).get('data',[])
if tasks: print(tasks[-1]['id'])
else: print('')
" 2>/dev/null)

if [ -z "$TASK_ID" ]; then
  log "❌ 서버에 running 태스크 없음"
  capture "01-no-task"
  # 한 번 더 시도
  sleep 30
  TASK_ID=$(curl -s "$API/tasks?status=running" 2>/dev/null | python3 -c "
import sys, json
tasks = json.load(sys.stdin).get('data',[])
if tasks: print(tasks[-1]['id'])
else: print('')
" 2>/dev/null)
  if [ -z "$TASK_ID" ]; then
    log "❌ 재시도 실패. 종료."
    tmux kill-session -t "$SESSION" 2>/dev/null; exit 1
  fi
fi

log "Task #$TASK_ID"
check_task "$TASK_ID"

# ─── /or-next 루프 ───
for round in $(seq 1 $MAX_ROUNDS); do
  echo ""
  log "━━━ Round $round/$MAX_ROUNDS ━━━"
  send "/or-next"

  # 응답 대기 (최대 120초)
  waited=0
  while [ $waited -lt 120 ]; do
    pane=$(tmux capture-pane -t "$SESSION" -p -S -80 2>/dev/null || echo "")

    # AskUserQuestion picker
    if echo "$pane" | grep -qE "^❯|☐|☑"; then
      log "  선택 UI 감지 → Enter"
      sleep 2; press_enter; sleep 8
      # 두 번째 picker가 나올 수 있음
      pane2=$(tmux capture-pane -t "$SESSION" -p -S -30 2>/dev/null || echo "")
      if echo "$pane2" | grep -qE "^❯|☐"; then
        log "  추가 선택 UI → Enter"
        sleep 1; press_enter; sleep 5
      fi
      break
    fi

    # 단계 완료 감지
    if echo "$pane" | grep -qE "단계 완료|다음 단계|or-next|완료.*Task"; then
      break
    fi

    # 에러 감지
    if echo "$pane" | grep -qE "활성 태스크가 없|시작하세요"; then
      log "  ⚠️ 태스크 없음 감지"
      break
    fi

    sleep 5; waited=$((waited + 5))
  done

  # 추가 대기 후 캡처
  sleep 5
  capture "round-$(printf '%02d' $round)"
  check_task "$TASK_ID"

  # 완료 확인
  STATUS=$(curl -s "$API/tasks/$TASK_ID" 2>/dev/null | python3 -c "
import sys, json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)

  if [ "$STATUS" = "completed" ]; then log "✅ 체인 완료!"; break; fi
  if [ "$STATUS" = "failed" ]; then log "❌ 체인 실패"; break; fi

  sleep 3
done

# ─── 최종 결과 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
log "최종 결과"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
capture "99-final"
check_task "$TASK_ID"

echo ""
log "캡처 파일:"
ls "$LOGDIR"/*.txt 2>/dev/null | while read f; do
  echo "  $(basename "$f") ($(wc -c < "$f" | tr -d ' ') bytes)"
done

echo ""
echo "tmux attach -t $SESSION"
echo "tmux kill-session -t $SESSION"
echo ""
log "테스트 종료"
