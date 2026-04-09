# OmegaRod 테스트 가이드

## 테스트 방식: tmux + scan + send-keys

Claude Code의 스킬과 MCP 통합을 테스트하는 방법입니다.
별도 tmux 세션에서 Claude Code를 실행하고, 메인 세션에서 화면을 읽고(scan) 키를 보내는(send) 방식으로 인터랙티브 테스트를 수행합니다.

### 기본 패턴

```
1. tmux 세션 생성 + Claude Code 시작
2. capture-pane으로 화면 읽기 (scan)
3. 상태 판단 (프롬프트? AskUserQuestion? thinking?)
4. send-keys로 입력 전송
5. 대기 후 다시 scan
6. 서버 API로 태스크 기록 검증
```

### 사전 준비

```bash
# 1. 웹서버 + WS Relay 실행
npm run dev &
npx tsx scripts/ws-relay.ts &

# 2. DB + Seed (DB 파일이 반드시 존재해야 MCP가 로드됨)
bash scripts/seed-v2.sh
ls data/omega-rod.db  # 확인 필수

# 3. tmux 세션 생성 + Claude Code 시작
tmux new-session -d -s or-test -x 140 -y 50
tmux send-keys -t or-test "claude --dangerously-skip-permissions" Enter

# 4. 초기화 대기 (20초)
sleep 20
```

### 핵심 명령어

```bash
# 화면 읽기 (최근 N줄)
tmux capture-pane -t or-test -p -S -30

# 텍스트 입력 + Enter
tmux send-keys -t or-test "/or-start 프로젝트 관리 도구" Enter

# Enter만 (AskUserQuestion 선택)
tmux send-keys -t or-test Enter

# 방향키 + Enter (두 번째 옵션 선택)
tmux send-keys -t or-test Down Enter

# 서버 태스크 확인
curl -s http://localhost:3000/api/tasks/1 | python3 -m json.tool
```

### 화면 상태 판단

| 패턴                               | 의미                       | 다음 행동                |
| ---------------------------------- | -------------------------- | ------------------------ |
| `❯` (프롬프트)                     | Claude 입력 대기           | 명령어 전송              |
| `❯ 1.` + `Enter to select`         | AskUserQuestion picker     | Enter 또는 방향키+Enter  |
| `☐` + options                      | AskUserQuestion (체크박스) | 스페이스로 선택 후 Enter |
| `thinking` / `Cooking` / `Churned` | Claude 처리 중             | 대기 (sleep)             |
| `or-next` 안내                     | 수동 단계 완료             | `/or-next` 전송          |

### 서버 검증

```bash
# 태스크 상태 + 로그 확인
curl -s http://localhost:3000/api/tasks/1 | python3 -c "
import sys, json
d = json.load(sys.stdin).get('data', {})
print(f'Task #{d[\"id\"]}: {d[\"status\"]} | Step {d[\"current_step\"]}')
for l in d.get('logs', []):
    icon = {'completed':'✅','pending':'⏳'}.get(l['status'],'?')
    title = l.get('node_title','')
    ntype = l.get('node_type','')
    out = (l.get('output','') or '')[:100].replace(chr(10),' ')
    print(f'  {icon} Step {l[\"step_order\"]} [{ntype}] {title}: {out}')
"
```

### 전체 테스트 흐름 예시

```bash
# 1. 세션 시작
tmux new-session -d -s or-test -x 140 -y 50
tmux send-keys -t or-test "claude --dangerously-skip-permissions" Enter
sleep 20

# 2. /or-start 전송
tmux send-keys -t or-test "/or-start 프로젝트 관리 도구" Enter
sleep 15

# 3. 화면 확인 — 체인 선택 UI가 나왔는지
tmux capture-pane -t or-test -p -S -20

# 4. Enter로 Recommended 선택
tmux send-keys -t or-test Enter
sleep 60  # Step 1 action 실행 대기

# 5. 화면 확인 — Step 1 완료 + Step 2 표시 확인
tmux capture-pane -t or-test -p -S -15

# 6. 서버 태스크 검증
curl -s http://localhost:3000/api/tasks/1 | python3 -m json.tool

# 7. /or-next 전송 (수동 단계인 경우)
tmux send-keys -t or-test "/or-next" Enter
sleep 30

# 8. 반복...

# 9. 정리
tmux kill-session -t or-test
```

### 자동화 테스트 스크립트

`tests/2/run-full-chain.sh` — 전체 체인을 스크립트로 자동 실행
`tests/3/run-brainstorm.sh` — 격리 환경에서 브레인스토밍 테스트

스크립트는 화면을 scan하고 AskUserQuestion을 감지하면 자동으로 Enter를 보냅니다.
하지만 Claude thinking 시간이 가변적이라 타이밍 이슈가 발생할 수 있습니다.

**권장**: 스크립트보다 위의 수동 scan+send 방식이 더 안정적입니다.

### 주의사항

1. **DB 파일 필수**: `data/omega-rod.db`가 없으면 MCP 로드 실패. 반드시 seed 후 Claude 시작.
2. **MCP 중복 금지**: 프로젝트 `.mcp.json`만 사용. 글로벌 `~/.claude/.mcp.json`은 잘못된 경로.
3. **thinking 대기**: Claude가 `thinking`/`Cooking` 상태일 때 send-keys를 보내면 메시지 큐에 쌓임. capture-pane으로 프롬프트(`❯`)가 나올 때까지 대기.
4. **터미널 크기**: `tmux new-session -x 140 -y 50`으로 크기 고정. 크기가 작으면 렌더링이 깨질 수 있음.
