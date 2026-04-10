#!/bin/bash
# BlueKiwi E2E Test — tmux + Claude Code 스킬/MCP 통합 테스트
#
# 테스트 시나리오: "프로젝트 관리 도구 웹앱 신규 개발 브레인스토밍" 체인 실행
#
# 사전 조건:
#   - BlueKiwi 웹서버 실행 중 (npm run dev, 포트 3000)
#   - seed 데이터 적용 완료 (bash scripts/seed-v2.sh)
#   - claude CLI 사용 가능
#
# 사용법:
#   bash tests/2/run-e2e.sh

set -euo pipefail

SESSION="or-e2e-test"
LOGDIR="$(cd "$(dirname "$0")" && pwd)/logs"
WORKDIR="/Users/dante/workspace/dante-code/projects/OmegaRod"
TIMEOUT_PER_STEP=120  # 각 스텝 최대 대기 시간 (초)

mkdir -p "$LOGDIR"
rm -f "$LOGDIR"/*.txt

echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BlueKiwi E2E Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Log dir: $LOGDIR"
echo ""

# ─── 사전 조건 확인 ───
echo "[CHECK] 웹서버..."
if ! curl -s -o /dev/null -w "" http://localhost:3000 2>/dev/null; then
  echo "  ❌ 웹서버가 실행되지 않았습니다. npm run dev를 먼저 실행하세요."
  exit 1
fi
echo "  ✅ 웹서버 OK"

echo "[CHECK] 워크플로 데이터..."
WF_COUNT=$(curl -s http://localhost:3000/api/workflows | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo 0)
if [ "$WF_COUNT" -eq 0 ]; then
  echo "  ❌ 워크플로가 없습니다. bash scripts/seed-v2.sh를 먼저 실행하세요."
  exit 1
fi
echo "  ✅ 워크플로 ${WF_COUNT}개 확인"

echo "[CHECK] tmux..."
if ! command -v tmux &>/dev/null; then
  echo "  ❌ tmux가 설치되지 않았습니다."
  exit 1
fi
echo "  ✅ tmux OK"

echo "[CHECK] claude CLI..."
if ! command -v claude &>/dev/null; then
  echo "  ❌ claude CLI를 찾을 수 없습니다."
  exit 1
fi
echo "  ✅ claude CLI OK"
echo ""

# ─── 기존 세션 정리 ───
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

# ─── 유틸 함수 ───
capture_pane() {
  local label="$1"
  local file="$LOGDIR/${label}.txt"
  tmux capture-pane -t "$SESSION" -p -S -100 > "$file" 2>/dev/null
  echo "$file"
}

wait_for_text() {
  local text="$1"
  local timeout="${2:-$TIMEOUT_PER_STEP}"
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    local content
    content=$(tmux capture-pane -t "$SESSION" -p -S -200 2>/dev/null || echo "")
    if echo "$content" | grep -q "$text"; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}

send_keys() {
  tmux send-keys -t "$SESSION" "$@"
}

send_text() {
  # 텍스트 입력 후 엔터
  tmux send-keys -t "$SESSION" "$1" Enter
}

log_step() {
  local step="$1"
  local msg="$2"
  echo "[STEP $step] $msg"
}

# ─── 테스트 시작 ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Claude Code 세션 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# 터미널 크기 고정 (120x40)
tmux new-session -d -s "$SESSION" -x 120 -y 40
tmux send-keys -t "$SESSION" "cd $WORKDIR && claude --dangerously-skip-permissions" Enter

echo "  Claude Code 초기화 대기 중..."
sleep 10
capture_pane "00-init"

# Claude가 준비되었는지 확인 (프롬프트 대기)
if ! wait_for_text "❯\|Claude Code" 30; then
  echo "  ❌ Claude Code가 시작되지 않았습니다."
  capture_pane "00-init-fail"
  cat "$LOGDIR/00-init-fail.txt"
  tmux kill-session -t "$SESSION" 2>/dev/null
  exit 1
fi
echo "  ✅ Claude Code 준비됨"

# ─── Step 1: /or-start 실행 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. /or-start 실행"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

send_text "/or-start 프로젝트 관리 도구 웹앱 신규 개발 브레인스토밍"
echo "  명령어 전송 완료. 응답 대기 중..."

# MCP 도구 호출 + 체인 선택 UI가 나올 때까지 대기
sleep 15
capture_pane "01-or-start-sent"

# AskUserQuestion이 나오면 Enter로 첫 번째 옵션(Recommended) 선택
# 또는 체인이 자동 매칭되어 바로 시작될 수 있음
if wait_for_text "체인" 60; then
  echo "  ✅ 체인 관련 출력 확인"
  capture_pane "02-workflow-response"
else
  echo "  ⚠️ 체인 응답을 감지하지 못했습니다. 캡처 확인 필요."
  capture_pane "02-workflow-response-timeout"
fi

# AskUserQuestion picker가 나왔으면 Enter로 선택
sleep 5
send_keys Enter
sleep 10
capture_pane "03-after-selection"

# 태스크 생성 확인
if wait_for_text "Task" 60; then
  echo "  ✅ 태스크 생성 확인"
  capture_pane "04-task-created"
else
  echo "  ⚠️ 태스크 생성을 감지하지 못했습니다."
  capture_pane "04-task-created-timeout"
fi

# or-next 안내가 나올 때까지 대기
if wait_for_text "or-next" 30; then
  echo "  ✅ /or-next 안내 확인"
else
  echo "  ⚠️ /or-next 안내를 감지하지 못했습니다."
fi
capture_pane "05-ready-for-next"

# ─── Step 2: /or-next 실행 (Step 1: 프로젝트 컨텍스트 탐색) ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. /or-next (Step 1: 프로젝트 컨텍스트 탐색)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

send_text "/or-next"
echo "  /or-next 전송. 실행 대기 중..."

# action 노드 실행 — 프로젝트 분석이 끝날 때까지 대기
if wait_for_text "Step" 90; then
  echo "  ✅ Step 진행 확인"
else
  echo "  ⚠️ Step 진행을 감지하지 못했습니다."
fi

# 완료될 때까지 추가 대기
sleep 20
capture_pane "06-step1-result"

# AskUserQuestion picker가 나왔으면 Enter
sleep 3
send_keys Enter
sleep 10
capture_pane "07-step1-after-enter"

# ─── Step 3: /or-next (Step 2: 비주얼 컴패니언 제안 — gate) ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. /or-next (Step 2: 비주얼 컴패니언 — gate)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

send_text "/or-next"
echo "  /or-next 전송. gate 응답 대기 중..."

sleep 15
capture_pane "08-step2-gate"

# gate 노드 — AskUserQuestion이 나오면 Enter로 선택
if wait_for_text "비주얼\|시각\|브라우저\|visual" 30; then
  echo "  ✅ 비주얼 컴패니언 질문 확인"
fi

sleep 5
send_keys Enter
sleep 15
capture_pane "09-step2-answered"

# ─── 결과 수집 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. 테스트 결과 수집"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# 서버 측 태스크 상태 확인
echo ""
echo "[SERVER] 태스크 상태:"
curl -s http://localhost:3000/api/tasks 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for t in d.get('data', []):
        logs = t.get('logs', [])
        completed = sum(1 for l in logs if l.get('status') == 'completed')
        print(f'  Task #{t[\"id\"]}: {t.get(\"workflow_title\", \"?\")} [{t[\"status\"]}] {completed}/{len(logs)} steps')
        for l in logs:
            icon = '✅' if l['status'] == 'completed' else '🔄' if l['status'] == 'running' else '⏳' if l['status'] == 'pending' else '❌'
            out = (l.get('output','') or '')[:80].replace(chr(10),' ')
            print(f'    {icon} Step {l[\"step_order\"]} [{l[\"status\"]}]: {out}')
except Exception as e:
    print(f'  Error: {e}')
" 2>/dev/null || echo "  (서버 조회 실패)"

# 로그 파일 목록
echo ""
echo "[LOGS] 캡처 파일:"
ls -la "$LOGDIR"/*.txt 2>/dev/null | awk '{print "  " $NF " (" $5 " bytes)"}'

# ─── 세션 정리 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 분석"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# 최종 화면 캡처
capture_pane "99-final"

echo ""
echo "테스트 세션이 아직 실행 중입니다."
echo "직접 확인하려면: tmux attach -t $SESSION"
echo "종료하려면: tmux kill-session -t $SESSION"
echo ""
echo "캡처된 로그를 확인하세요:"
echo "  cat $LOGDIR/05-ready-for-next.txt    # /or-start 결과"
echo "  cat $LOGDIR/06-step1-result.txt      # Step 1 결과"
echo "  cat $LOGDIR/09-step2-answered.txt    # Step 2 결과"
echo "  cat $LOGDIR/99-final.txt             # 최종 화면"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "E2E 테스트 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
