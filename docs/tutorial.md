# OmegaRod 사용 가이드

에이전트 지침을 서버에 등록하고, Claude Code에서 체인 형태로 단계별 실행하는 시스템입니다.

## 목차

1. [시작하기](#1-시작하기)
2. [지침 만들기](#2-지침-만들기)
3. [체인 만들기](#3-체인-만들기)
4. [Claude Code에서 실행하기](#4-claude-code에서-실행하기)
5. [태스크 모니터링](#5-태스크-모니터링)
6. [아키텍처](#6-아키텍처)

---

## 1. 시작하기

### 서버 실행

```bash
cd /path/to/OmegaRod

# 터미널 1: 웹서버 (포트 3000)
npm run dev

# 터미널 2: WebSocket Relay (포트 3001, 실시간 모니터링용)
npm run ws
```

### 접속

| 페이지          | URL                                | 설명                  |
| --------------- | ---------------------------------- | --------------------- |
| 홈              | http://localhost:3000              | 전체 메뉴             |
| 지침 관리       | http://localhost:3000/instructions | 재사용 지침 CRUD      |
| 체인 관리       | http://localhost:3000/chains       | 체인 편집기           |
| 태스크 모니터링 | http://localhost:3000/tasks        | 실행 상태 실시간 확인 |
| API 문서        | http://localhost:3000/docs         | Swagger UI            |

### 샘플 데이터 넣기

```bash
bash scripts/seed.sh
```

3개의 체인과 5개의 재사용 지침이 생성됩니다.

---

## 2. 지침 만들기

지침(Instruction)은 에이전트에게 주는 **재사용 가능한 행동 블록**입니다.

### 웹 UI에서 만들기

1. http://localhost:3000/instructions 접속
2. 제목, 내용, 에이전트 유형, 태그, 우선순위 입력
3. **추가** 클릭

### 예시: 보안 코드 리뷰 지침

```
제목: 보안 코드 리뷰
유형: coding
태그: 보안, 리뷰
내용:
  OWASP Top 10 기준으로 코드를 검토하세요.
  - Injection (SQL, Command, XSS)
  - Broken Authentication
  - Sensitive Data Exposure
  발견된 이슈를 severity(critical/high/medium/low)로 분류하세요.
```

### API로 만들기

```bash
curl -X POST http://localhost:3000/api/instructions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "보안 코드 리뷰",
    "content": "OWASP Top 10 기준으로 코드를 검토하세요...",
    "agent_type": "coding",
    "tags": ["보안", "리뷰"],
    "priority": 10
  }'
```

### 지침 설계 팁

- **하나의 지침 = 하나의 명확한 행동**. "분석하고 수정하세요"보다 "분석하세요", "수정하세요"를 별도 지침으로.
- **구체적으로 작성**: "코드를 검토하세요"보다 "OWASP Top 10 기준으로 SQL Injection, XSS를 중점 검토하세요".
- **출력 형식 명시**: "severity(critical/high/medium/low)로 분류하여 보고하세요".

---

## 3. 체인 만들기

체인(Chain)은 지침 노드를 **순서대로 연결한 워크플로**입니다.

### 노드 타입

| 타입       | 역할                          | 예시                                   |
| ---------- | ----------------------------- | -------------------------------------- |
| **Action** | 지침을 자율적으로 수행        | "프로젝트 구조를 분석하세요"           |
| **Gate**   | 사용자에게 질문하고 답변 대기 | "어떤 기능을 만들고 싶으신가요?"       |
| **Loop**   | 조건 충족까지 반복            | "추가 질문이 필요하면 계속 물어보세요" |

### 웹 UI에서 만들기

1. http://localhost:3000/chains 접속
2. **+ 새 체인** 클릭
3. 체인 제목, 설명 입력
4. **+ 노드 추가**로 단계를 하나씩 추가:
   - 노드 제목 입력
   - 타입 선택 (Action / Gate / Loop)
   - 지침 소스 선택:
     - **직접 작성**: 인라인으로 지침 텍스트 입력
     - **지침 참조**: 기존 지침을 드롭다운에서 선택
   - Loop 타입인 경우: 되돌아갈 스텝 번호 지정
5. 위/아래 버튼으로 노드 순서 조정
6. 하단 파이프라인 미리보기 확인
7. **생성** 클릭

### 예시: 기능 브레인스토밍 체인

```
체인: 기능 브레인스토밍
설명: 새 기능 아이디어를 탐색하고 설계 문서로 정리

  Step 1 [Action]  프로젝트 컨텍스트 파악  → 지침 #1 참조
  Step 2 [Gate]    기능 목표 확인          → "어떤 기능을 만들고 싶으신가요?"
  Step 3 [Loop]    추가 질문               → 정보가 충분할 때까지 반복 (↩ Step 3)
  Step 4 [Action]  접근 방식 제안          → 지침 #2 참조
  Step 5 [Gate]    접근 방식 선택          → "어떤 방식이 좋으시겠습니까?"
  Step 6 [Action]  설계 문서 작성          → 지침 #3 참조
  Step 7 [Gate]    설계 검토               → "설계를 검토해주세요"
  Step 8 [Action]  구현 계획 작성          → 지침 #5 참조
```

### 체인 설계 패턴

**패턴 1: 수집 → 분석 → 보고**

```
[Action] 데이터 수집 → [Action] 분석 → [Gate] 결과 확인 → [Action] 보고서 작성
```

**패턴 2: 대화형 설계**

```
[Gate] 목표 확인 → [Loop] 요구사항 수집 → [Action] 설계 → [Gate] 검토 → [Action] 구현
```

**패턴 3: 자동 파이프라인**

```
[Action] 빌드 → [Action] 테스트 → [Action] 보안 검토 → [Action] 배포 준비
```

---

## 4. Claude Code에서 실행하기

### 사전 준비

OmegaRod 프로젝트 디렉토리에서 Claude Code 세션을 시작합니다.
MCP 서버는 `.mcp.json`에 등록되어 있어 자동으로 로드됩니다.

```bash
cd /path/to/OmegaRod
claude
```

### 스킬로 실행

```
/omegarod:start
```

실행 흐름:

```
사용자: /omegarod:start

Claude: 실행 가능한 체인 목록을 조회합니다...

  실행 가능한 체인:
    1. 기능 브레인스토밍 — 새 기능 아이디어를 탐색 (8단계)
       └─ 1. 컨텍스트 파악 → 2. 목표 확인 → 3. 추가 질문 → ...
    2. PR 보안 리뷰 — PR의 보안 취약점 검토 (4단계)
    3. 데이터 분석 파이프라인 — 데이터 수집/분석/시각화 (6단계)

  어떤 체인을 실행하시겠습니까? (번호 입력)

사용자: 1

Claude: 🔄 체인 "기능 브레인스토밍" 실행을 시작합니다. (Task #2)
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 Step 1/8: 프로젝트 컨텍스트 파악
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  (프로젝트 구조, package.json, 최근 커밋 분석 수행...)

  ✅ Step 1/8 완료
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 Step 2/8: 기능 목표 확인 [Gate]
  ━━━━━━━━━━━━━━━━━━━━━━━━━
  어떤 기능을 만들고 싶으신가요?

사용자: 사용자 인증 시스템을 추가하고 싶어

Claude: (응답 기록 후 다음 스텝으로 진행...)
  ...
```

### MCP 도구 직접 사용

스킬 없이 MCP 도구를 직접 호출할 수도 있습니다:

```
# 체인 목록 조회
mcp__omega-rod__list_chains

# 체인 실행 시작
mcp__omega-rod__start_chain  chain_id: 4

# 스텝 결과 보고
mcp__omega-rod__report_step  task_id: 1  node_id: 21  output: "분석 완료"  status: "completed"

# 다음 스텝 요청
mcp__omega-rod__get_next_step  task_id: 1

# 중간 상황 보고
mcp__omega-rod__heartbeat  task_id: 1  node_id: 22  progress: "파일 3/10 분석 중..."

# 태스크 완료
mcp__omega-rod__complete_task  task_id: 1  status: "completed"  summary: "전체 요약"
```

---

## 5. 태스크 모니터링

Claude Code가 체인을 실행하는 동안 브라우저에서 실시간으로 진행 상황을 확인할 수 있습니다.

### 실시간 모니터링

1. `npm run ws`로 WebSocket Relay 실행 (포트 3001)
2. http://localhost:3000/tasks 접속
3. Claude Code에서 체인 실행 시작
4. 브라우저에서 프로그레스 바와 스텝 로그가 실시간 업데이트

### 태스크 목록 (http://localhost:3000/tasks)

- 상태 필터: 전체 / 실행 중 / 완료 / 실패 / 대기
- 각 태스크의 프로그레스 바
- WebSocket으로 즉시 업데이트 (폴링 없음)

### 태스크 상세 (http://localhost:3000/tasks/:id)

- 체인 이름, 진행 상황, 시작/업데이트 시각
- 스텝별 타임라인 로그
- 각 스텝의 출력(output) 전문

### API로 조회

```bash
# 태스크 목록
curl http://localhost:3000/api/tasks

# 실행 중인 태스크만
curl http://localhost:3000/api/tasks?status=running

# 특정 태스크 상세 (로그 포함)
curl http://localhost:3000/api/tasks/1
```

---

## 6. 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  웹 UI (localhost:3000)                                  │
│  /instructions — 지침 CRUD                               │
│  /chains       — 체인 편집기                              │
│  /tasks        — 태스크 모니터링 (WebSocket 실시간)        │
│  /docs         — Swagger UI                              │
└──────┬────────────────────────────────────┬──────────────┘
       │ REST API                           │ ws://3001
       │                                    │
┌──────▼──────────────┐          ┌──────────▼──────────────┐
│  Next.js API Routes  │          │  WS Relay (port 3001)   │
│  /api/instructions   │          │  HTTP POST /notify      │
│  /api/chains         │          │  → broadcast to browser │
│  /api/tasks          │          └──────────▲──────────────┘
└──────┬───────────────┘                     │
       │                                     │ fire-and-forget
┌──────▼──────────────────────────┐          │
│          SQLite (WAL)            │          │
│  data/omega-rod.db               │◄─────────┤
│                                  │          │
│  instructions — 재사용 지침       │   ┌──────┴──────────────┐
│  chains       — 워크플로 정의     │   │  MCP Server (stdio)  │
│  chain_nodes  — 단계별 노드       │   │  omega-rod           │
│  tasks        — 실행 인스턴스     │   │  6개 도구            │
│  task_logs    — 스텝별 로그       │   └──────▲──────────────┘
└──────────────────────────────────┘          │ MCP (stdin/stdout)
                                     ┌───────┴──────────────┐
                                     │  Claude Code Session  │
                                     │  /omegarod:start      │
                                     └──────────────────────┘
```

### 데이터 모델

```
instructions (재사용 지침 블록)
  └─ id, title, content, agent_type, tags, priority, is_active

chains (워크플로 정의)
  └─ id, title, description

chain_nodes (체인 내 노드)
  ├─ chain_id (FK → chains)
  ├─ instruction_id (FK → instructions, nullable)
  ├─ step_order, node_type (action|gate|loop)
  ├─ title, instruction (인라인)
  └─ loop_back_to (loop 노드용)

tasks (실행 인스턴스)
  ├─ chain_id (FK → chains)
  ├─ status (pending|running|completed|failed)
  └─ current_step

task_logs (스텝별 실행 기록)
  ├─ task_id (FK → tasks)
  ├─ node_id (FK → chain_nodes)
  ├─ step_order, status, output
  └─ started_at, completed_at
```

### 파일 구조

```
OmegaRod/
├── .mcp.json                 # Claude Code MCP 등록
├── .claude/skills/start.md   # /omegarod:start 스킬
├── mcp/
│   └── src/server.ts         # MCP 서버 (6개 도구 + WS notify)
├── scripts/
│   ├── seed.sh               # 더미 데이터 시드
│   └── ws-relay.ts           # WebSocket Relay 서버
├── src/
│   ├── lib/
│   │   ├── db.ts             # SQLite + 타입 + 헬퍼
│   │   ├── openapi.ts        # Swagger 스펙
│   │   └── use-ws.ts         # WebSocket 클라이언트 훅
│   └── app/
│       ├── api/              # REST API 라우트
│       ├── instructions/     # 지침 관리 UI
│       ├── chains/           # 체인 편집기 UI
│       ├── tasks/            # 태스크 모니터링 UI
│       └── docs/             # Swagger UI
└── data/
    └── omega-rod.db          # SQLite DB (gitignore)
```
