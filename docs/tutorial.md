# BlueKiwi 사용 가이드

이 문서는 `docs/tutorial.md`를 기준으로 BlueKiwi의 **현행 아키텍처**와 **2트랙 사용법**(저자/엔드유저)을 정리합니다.

## 0. 개요

- 한 줄 정의: 에이전트 지침을 서버에 등록하고, Claude Code 같은 런타임이 MCP를 통해 단계별로 실행
- 2트랙 사용법:
  - (A) 저자(워크플로 저자) — 워크플로 설계·등록·버전관리
  - (B) 엔드유저(소비자) — 워크플로 실행·되감기·결과 기록
- 아키텍처 한 컷:

```
[Author Claude Code] ──┐
                       ├─ MCP stdio → BlueKiwiClient → REST → Next.js + Postgres
[End-user Claude Code] ─┘
```

## 1. 셀프호스트 (공통)

### 1.1 요구사항

- Node.js + npm(또는 pnpm/yarn) — 서버 개발 모드(`next dev`) 실행용
- Docker + Docker Compose — PostgreSQL 기동용
- (선택) `psql` — 마이그레이션/DB 폴링을 로컬에서 하고 싶을 때

### 1.2 DB 기동 및 마이그레이션 (docker compose)

로컬에서 가장 단순한 개발 흐름은 **DB만 Docker로 띄우고**, 앱은 호스트에서 실행하는 방식입니다.

1. DB 컨테이너 기동(예: 개발용 compose 파일)

```bash
docker compose -f docker/docker-compose.dev.yml up db -d
```

2. 마이그레이션 적용(수동)

- 마이그레이션 파일은 `docker/migrations/*.sql`에 있으며, **기존 DB 업그레이드 목적**으로 누적되어 있습니다.
- 주의: 일부 마이그레이션은 레거시 테이블명(`chains`)을 전제로 합니다. 새 DB(`docker/init.sql`로 생성)에는 적용이 불필요하거나 실패할 수 있으니, **실패 시 해당 파일은 건너뛰고 다음으로 진행**하세요.

```bash
# docker 내부 psql로 실행 (호스트에 psql 없어도 됨)
for f in $(ls docker/migrations/*.sql | sort); do
  echo "==> $f"
  cat "$f" | docker compose -f docker/docker-compose.dev.yml exec -T db psql -U bluekiwi -d bluekiwi
done
```

### 1.3 Next.js 개발 서버 (npm run dev)

```bash
# 의존성 설치
npm install

# Next.js dev server (기본 포트 3000)
npm run dev:raw
```

- 접속: `http://localhost:3000`
- DB 연결: `DATABASE_URL` 환경변수(예: `.env.local`)를 사용합니다.

> 참고: `npm run dev`는 이 리포지토리에서 Docker 기반 dev 스택 래퍼(`scripts/dev.sh`)로 구성되어 있을 수 있습니다. “호스트에서 Next.js를 3000으로 띄우는” 흐름은 `npm run dev:raw`가 확실합니다.

### 1.4 첫 관리자 계정 생성 (/api/auth/setup)

최초 1회, 첫 계정은 `superuser`로 생성됩니다.

```bash
# (선택) 셋업 필요 여부 확인
curl -sS http://localhost:3000/api/auth/setup

# 첫 superuser 생성
curl -sS -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@local","password":"admin1234"}'
```

### 1.5 API 키 발급 (scripts/cli.ts apikey)

MCP/CLI는 REST 호출용 API 키(`bk_...`)가 필요합니다. 가장 확실한 발급 방법은 DB에 직접 키를 생성하는 `scripts/cli.ts`입니다.

1. 사용자 ID 확인

```bash
npx tsx scripts/cli.ts user list
```

2. API 키 생성(예: user id=1)

```bash
# 30일 만료 키
npx tsx scripts/cli.ts apikey create --user-id=1 --name=mcp --expires=30

# 영구 키
npx tsx scripts/cli.ts apikey create --user-id=1 --name=mcp
```

- 출력되는 `Raw Key`는 **1회만 노출**되므로 안전하게 보관하세요.
- 예시 형식: `bk_abc123...` (실제는 base64url 기반의 긴 문자열)

## 2. 저자 트랙 — 워크플로 등록

### 2.1 CLI 설치: bluekiwi init (--server, --api-key, --runtime, --yes 플래그 지원)

저자/운영자는 보통 `editor` 이상 권한이 필요합니다.

```bash
# 인터랙티브 설치 (TTY)
npx bluekiwi init
```

```bash
# 비대화형 설치 (CI/tmux 하네스용)
npx bluekiwi init --server http://localhost:3000 --api-key bk_abc123 --runtime claude-code --yes

# 환경변수로도 가능 (우선순위: flags > env > prompts)
BLUEKIWI_SERVER=http://localhost:3000 \
BLUEKIWI_API_KEY=bk_abc123 \
BLUEKIWI_RUNTIMES=claude-code \
npx bluekiwi init --yes
```

플래그: `--server <url>`, `--api-key <key>`, `--runtime <name>`(반복 또는 콤마 구분), `--yes`. `--yes`를 주면 누락된 필수 값에 대해 프롬프트 대신 에러로 종료합니다.

핵심은 CLI가 지원 런타임(Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw 등)에 아래 구성을 설치하는 것입니다.

- 번들 스킬: `bk-start`, `bk-next`, `bk-rewind`, `bk-status`
- MCP 서버 래퍼(stdio): `mcp/src/server.ts` 빌드 산출물(보통 `node .../mcp/dist/server.js`)
  - 환경변수: `BLUEKIWI_API_URL`, `BLUEKIWI_API_KEY`

### 2.2 Claude Code에서 MCP 연결 확인

1. 설치 후 런타임에서 `bluekiwi` MCP 서버가 보이는지 확인
2. 가장 빠른 확인은 “도구 목록” 호출입니다(런타임마다 호출 방식은 다르지만, Claude Code 기준 예시는 아래).

```text
mcp__bluekiwi__list_workflows
```

- `BLUEKIWI_API_URL`은 서버 origin을 넣습니다. 예: `http://localhost:3000` (끝에 `/api`를 붙이지 않음)

### 2.3 create_workflow 도구로 워크플로 등록

`create_workflow`는 `/api/workflows`(POST)에 매핑됩니다.

#### 인풋 형식 예시 (title, description, version, evaluation_contract, nodes[])

```text
mcp__bluekiwi__create_workflow
  title: "컴플라이언스 리뷰 (Korea OTA)"
  description: "scan_repo로 정적 신호를 수집하고, 결과를 리뷰 로그로 남긴다"
  version: "1.0"
  evaluation_contract:
    global:
      require_all_context_snapshots: true
    steps:
      "1":
        require_context_snapshot: true
      "2":
        require_context_snapshot: true
  nodes:
    - title: "리뷰 대상 확인"
      node_type: "gate"
      instruction: "사용자에게 리뷰 대상(레포/경로/브랜치/범위)을 질문하고, target_meta 규격으로 정리한다."
      auto_advance: false
    - title: "정적 스캔 실행"
      node_type: "action"
      instruction: "scan_repo를 호출해 리스크 신호를 수집하고, 핵심 요약을 output에 남긴다."
      auto_advance: true
    - title: "결과 정리 및 종료"
      node_type: "action"
      instruction: "핵심 이슈를 severity별로 요약하고, 필요한 수정 방향을 제안한 뒤 complete_task로 마무리한다."
      auto_advance: true
```

#### 노드 구조와 step_order

- `nodes[]` 배열 순서가 곧 `step_order`(1부터)입니다.
- 노드 필드(서버 기준): `title`, `node_type`(`action|gate|loop`), `instruction` 또는 `instruction_id`, (선택) `loop_back_to`, `auto_advance`, `credential_id`

#### evaluation_contract 계약 예시

`evaluation_contract`는 현재 **자유형 JSONB**로 저장되며(검증 로직은 별도), “각 스텝 결과 품질 계약”을 서버에 같이 저장하려는 목적입니다.

```json
{
  "global": { "require_all_context_snapshots": true },
  "steps": {
    "1": { "require_context_snapshot": true, "min_output_length": 200 },
    "2": { "require_context_snapshot": true }
  }
}
```

### 2.4 update_workflow 로 버전 올리기 (create_new_version=true)

`update_workflow`는 `/api/workflows/:id`(PUT)에 매핑되며, `create_new_version=true` + `nodes[]`를 함께 보내면:

- 기존 family의 활성 버전을 비활성화(`is_active=false`)
- 버전을 자동 증가(예: `1.0 → 1.1`)
- 새 row를 생성하고(`parent_workflow_id`로 이전 버전을 가리킴) 새 버전을 활성화

```text
mcp__bluekiwi__update_workflow
  workflow_id: 12
  create_new_version: true
  nodes: [ ...새 노드 배열... ]
```

### 2.5 delete_workflow 로 제거

`delete_workflow`는 `/api/workflows/:id`(DELETE)에 매핑됩니다. (권한상 `admin` 이상 권장)

```text
mcp__bluekiwi__delete_workflow
  workflow_id: 12
```

## 3. 엔드유저 트랙 — 워크플로 실행

### 3.1 CLI 설치 (viewer/editor 키로)

엔드유저는 보통 팀에서 발급된 방식 중 하나로 API 키를 받습니다.

- 초대 기반(권장): `bluekiwi accept <token> --server <url>` → 계정 생성 + 키 발급 + 런타임 설치
- 이미 키가 있다면: `bluekiwi init`로 런타임에 MCP/스킬만 설치

### 3.2 list_workflows 로 등록된 워크플로 확인

```text
mcp__bluekiwi__list_workflows
  include_inactive: false
```

### 3.3 start_workflow 로 태스크 시작 (target 필드로 리뷰 대상 명시)

`start_workflow`는 `/api/tasks/start`(POST)에 매핑되며, `target`은 `tasks.target_meta(JSONB)`로 저장됩니다.

```text
mcp__bluekiwi__start_workflow
  workflow_id: 12
  context: "이번 PR 머지 전에 컴플라이언스 사전 점검"
  session_meta: "{\"project_dir\":\"/Users/me/repo\",\"git_branch\":\"main\",\"agent\":\"claude-code\",\"model_id\":\"claude-opus-4\"}"
  target:
    kind: "repo"
    repo_name: "OmegaRod"
    path: "."
    git_branch: "main"
    include_paths: ["src", "packages"]
    exclude_paths: ["node_modules", ".next"]
```

### 3.4 execute_step / advance / rewind 진행 제어

일반적인 실행 흐름(런타임이 자동화할 수도 있고, 수동으로 도구를 호출할 수도 있습니다):

1. `start_workflow` 반환값에서 `current_step.node_id` 확인
2. 일을 수행한 뒤 `execute_step`으로 결과 기록(`status="completed"` 권장)
3. `advance`로 다음 단계로 이동
4. 필요 시 `rewind`로 특정 스텝으로 되돌아감

```text
# Step 결과 기록
mcp__bluekiwi__execute_step
  task_id: 101
  node_id: 9001
  status: "completed"
  output: "✅ 정적 스캔을 완료했고, BLOCK 1건 / REVIEW 3건을 확인했습니다."
  context_snapshot:
    decisions:
      - question: "스캔 범위"
        chosen: "src, packages"
        reason: "프로덕션 코드 위주"
    key_findings:
      - "ISMS-001-SECRET: 하드코딩 시크릿 의심 패턴 1건"
    next_step_hint: "해당 라인의 실제 시크릿 여부 확인 및 환경변수화"
```

```text
# 다음 스텝 진행 (peek=true면 현재 상태 조회)
mcp__bluekiwi__advance
  task_id: 101
  peek: false
```

```text
# 되감기
mcp__bluekiwi__rewind
  task_id: 101
  to_step: 2
```

### 3.5 save_findings 로 컴플라이언스 finding 적재 (REST: POST /api/tasks/:id/findings)

주의: 현행 코드 기준으로 `compliance_findings` 테이블 스키마는 존재하지만,

- `/api/tasks/:id/findings` 라우트는 구현되어 있지 않습니다.
- MCP 도구 `save_findings` / `list_findings`도 존재하지 않습니다.

대신(임시 워크어라운드):

- 스캔 결과를 `execute_step.structured_output` 또는 `task_comments`로 남기기
- 또는 운영자가 DB에 직접 INSERT(아래 4.3/5.2 참고)

### 3.6 complete_task 로 태스크 완료

```text
mcp__bluekiwi__complete_task
  task_id: 101
  status: "completed"
  summary: "BLOCK 1건(시크릿 의심) 수정 필요. REVIEW 3건(PII 필드명/지오로케이션) 확인."
```

### 3.7 bk-start / bk-next / bk-rewind / bk-status 번들 스킬 활용

CLI가 설치한 번들 스킬을 쓰면, 엔드유저는 MCP 도구를 직접 호출하지 않아도 됩니다.

```text
/bk-start
/bk-next
/bk-status
/bk-rewind 2
```

- `/bk-start`: 워크플로 선택 → `start_workflow` → 1번 스텝 실행
- `/bk-next`: 현재 스텝 마무리 → `execute_step` → `advance` 루프
- `/bk-rewind`: `rewind` 후 특정 스텝 재실행
- `/bk-status`: 실행 중/완료 태스크 요약 표시

## 4. 컴플라이언스 리뷰 워크플로 예시 (실전)

### 4.1 리뷰 대상 표준화 — target_meta 스키마 설명

`target_meta`는 서버가 강제 검증하지 않는 “관례 스키마”입니다. 팀에서 표준을 정해두면, 워크플로/리포팅/재현성이 좋아집니다.

권장 예시:

```json
{
  "kind": "repo",
  "repo_name": "OmegaRod",
  "path": ".",
  "git_remote": "git@github.com:org/repo.git",
  "git_branch": "main",
  "git_ref": "HEAD",
  "include_paths": ["src", "packages"],
  "exclude_paths": ["node_modules", ".next"],
  "requested_by": { "name": "dante", "channel": "slack" }
}
```

### 4.2 scan_repo 로 결정적 정적 스캔 (rule_set='korea-ota-code')

`scan_repo`는 MCP 도구 중 **유일한 로컬 실행 예외**입니다.

- 대부분 MCP 도구: REST 프록시(서버가 저장/권한/RBAC 책임)
- `scan_repo`: 에이전트가 실행 중인 로컬 파일시스템을 스캔(서버 호출 없음)

#### 내장 6패턴 설명 + custom_patterns 확장법

`rule_set="korea-ota-code"` 내장 패턴(6개):

- `PIPA-001-RRN` (REVIEW): `\b\d{6}-?\d{7}\b` (주민/외국인등록번호 형식)
- `ISMS-001-SECRET` (BLOCK): `password|secret|api_key|token|private_key ...` 형태의 하드코딩 시크릿 의심
- `PIPA-002-FIELD` (REVIEW): `residentRegistration|passport|cardNumber|cvv|accountNumber ...` 등 고위험 필드명
- `ISMS-004-HTTP` (WARN): 외부 평문 `http://` URL(로컬호스트 제외)
- `LIA-001-GEO` (REVIEW): `navigator.geolocation.getCurrentPosition/watchPosition`
- `PIPA-004-PRECHECK` (REVIEW): 사전 체크된 동의 체크박스(`checked=true` 등)

확장(커스텀) 패턴 예시:

```text
mcp__bluekiwi__scan_repo
  path: "."
  rule_set: "korea-ota-code"
  max_matches: 200
  custom_patterns:
    - id: "CUSTOM-001-INTERNAL-API"
      severity: "WARN"
      description: "내부 API URL 하드코딩"
      regex: "https://internal\\.example\\.com"
```

### 4.3 finding 레코드 구조 — rule_id, severity (BLOCK/REVIEW/WARN/INFO), summary, detail, fix, authority

`compliance_findings` 테이블 + REST `POST /api/tasks/:id/findings` + MCP `save_findings`/`list_findings` 로 쓰기·조회가 모두 연결되어 있습니다. 필수 필드:

- `task_id` (필수), `step_order`(선택)
- `rule_id` (필수): 예) `ISMS-001-SECRET`
- `severity` (필수): `BLOCK|REVIEW|WARN|INFO`
- `summary` (필수): 한 줄 요약
- `detail` / `fix` / `authority` (선택): 근거/수정/권위(법/가이드)
- `file_path`, `line_number`, `source`, `metadata` (선택)

### 4.4 엔드 투 엔드 예시: target 설정 → scan_repo 호출 → save_findings → complete_task

```text
# 1) 태스크 시작 (target_meta 포함)
mcp__bluekiwi__start_workflow
  workflow_id: 12
  target: { "kind":"repo", "repo_name":"OmegaRod", "path":"." }

# 2) 로컬 정적 스캔
mcp__bluekiwi__scan_repo
  path: "."
  rule_set: "korea-ota-code"
  max_matches: 200

# 3) finding 저장 (MCP save_findings → REST POST /api/tasks/:id/findings)
mcp__bluekiwi__save_findings
  task_id: 101
  findings:
    - rule_id: "ISMS-001-SECRET"
      severity: "BLOCK"
      summary: "하드코딩된 Stripe 라이브 키 노출"
      detail: "PaymentService.java:6에 sk_live_...가 평문 저장됨"
      fix: "환경변수 또는 KMS로 이관"
      authority: "ISMS-P 2.7.1, 내부 베이스라인"
      file_path: "backend/src/main/java/com/ota/PaymentService.java"
      line_number: 6
      source: "manual"

# 4) 태스크 종료
mcp__bluekiwi__complete_task
  task_id: 101
  status: "completed"
  summary: "scan_repo 결과 기반 컴플라이언스 요약 완료"
```

## 5. 관측 및 디버깅

### 5.1 REST 직접 호출 (curl + Bearer)

```bash
export BK_URL="http://localhost:3000"
export BK_KEY="bk_abc123"

# 워크플로 목록
curl -sS "$BK_URL/api/workflows" -H "Authorization: Bearer $BK_KEY"

# 태스크 시작
curl -sS -X POST "$BK_URL/api/tasks/start" \
  -H "Authorization: Bearer $BK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id":12,"context":"quick run","target":{"kind":"repo","path":"."}}'
```

> 보안 주의: `src/app/api/tasks/**` 일부 라우트는 현재 `with-auth`가 적용되지 않아 외부 노출 시 위험할 수 있습니다(코드 기준). 운영 환경에서는 반드시 네트워크 레벨에서 보호하세요.

### 5.2 DB 폴링 (tasks, task_logs, compliance_findings 테이블)

```bash
# 예: 호스트 psql 사용
psql "$DATABASE_URL" -c "SELECT id, status, current_step, created_at, updated_at FROM tasks ORDER BY id DESC LIMIT 20;"
psql "$DATABASE_URL" -c "SELECT task_id, step_order, status, node_title FROM task_logs WHERE task_id=101 ORDER BY step_order ASC;"
psql "$DATABASE_URL" -c "SELECT task_id, severity, rule_id, summary, created_at FROM compliance_findings WHERE task_id=101 ORDER BY created_at DESC;"
```

### 5.3 tmux capture-pane 보조 관측

에이전트 런타임을 tmux에서 띄웠다면, 로그 증적을 남길 때 `capture-pane`이 유용합니다.

```bash
# 현재 pane의 마지막 200줄을 파일로 저장
tmux capture-pane -p -S -200 > /tmp/bluekiwi-session.log

# 특정 pane 지정 (세션:윈도우.패널)
tmux capture-pane -t 0:1.0 -p -S -200 > /tmp/bluekiwi-step.log
```

## 6. API 참조 요약

### 6.1 인증

- API 키: `Authorization: Bearer bk_...`
- RBAC: `superuser > admin > editor > viewer`
- 주의: 일부 라우트는 `withOptionalAuth`로 “헤더가 없으면 통과(웹 UI 호환)” 동작을 합니다. 자동화/런타임 환경에서는 **항상 Bearer를 포함**하는 것을 권장합니다.

### 6.2 워크플로 CRUD

- `GET /api/workflows` (`?include_inactive=true` 지원)
- `POST /api/workflows`
- `GET /api/workflows/:id`
- `PUT /api/workflows/:id` (`create_new_version=true` 지원)
- `DELETE /api/workflows/:id`
- `GET /api/workflows/:id/versions`
- `POST /api/workflows/:id/activate`
- `POST /api/workflows/:id/deactivate`

### 6.3 태스크 라이프사이클

- `GET /api/tasks`
- `POST /api/tasks/start`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/execute`
- `POST /api/tasks/:id/advance` (body: `{ "peek": true }` 가능)
- `POST /api/tasks/:id/heartbeat`
- `POST /api/tasks/:id/rewind`
- `POST /api/tasks/:id/complete`
- `GET/POST /api/tasks/:id/comments`
- `GET/POST /api/tasks/:id/logs`
- `POST /api/tasks/:id/respond` (gate 응답 저장)

### 6.4 Findings

- 스키마: `compliance_findings` 테이블이 존재합니다.
- 주의: 현행 코드 기준 `/api/tasks/:id/findings` REST 라우트는 아직 없습니다.

### 6.5 MCP 도구 목록 (이름 / 설명 / 매핑된 REST)

`mcp/src/server.ts` 기준:

| MCP tool                            | 역할                 | 매핑                                                                                          |
| ----------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `list_workflows`                    | 워크플로 목록        | `GET /api/workflows`                                                                          |
| `list_workflow_versions`            | 버전 목록            | `GET /api/workflows/:id/versions`                                                             |
| `activate_workflow`                 | 특정 버전 활성화     | `POST /api/workflows/:id/activate`                                                            |
| `deactivate_workflow`               | 특정 버전 비활성화   | `POST /api/workflows/:id/deactivate`                                                          |
| `create_workflow`                   | 생성                 | `POST /api/workflows`                                                                         |
| `update_workflow`                   | 수정/새 버전         | `PUT /api/workflows/:id`                                                                      |
| `delete_workflow`                   | 삭제                 | `DELETE /api/workflows/:id`                                                                   |
| `start_workflow`                    | 태스크 시작          | `POST /api/tasks/start`                                                                       |
| `execute_step`                      | 스텝 결과 기록       | `POST /api/tasks/:id/execute`                                                                 |
| `advance`                           | 다음 스텝/peek       | `POST /api/tasks/:id/advance`                                                                 |
| `heartbeat`                         | 진행 상황 append     | `POST /api/tasks/:id/heartbeat`                                                               |
| `rewind`                            | 되감기               | `POST /api/tasks/:id/rewind`                                                                  |
| `complete_task`                     | 종료                 | `POST /api/tasks/:id/complete`                                                                |
| `get_comments`                      | 코멘트               | `GET /api/tasks/:id/comments`                                                                 |
| `list_credentials`                  | 크리덴셜 목록        | `GET /api/credentials`                                                                        |
| `scan_repo`                         | 정적 스캔(로컬 예외) | (REST 없음, 로컬 실행)                                                                        |
| `get_web_response`                  | 웹 응답 조회         | 주의: 코드상 `GET /api/tasks/:id/respond`로 호출하지만, 서버 라우트는 `POST`만 존재할 수 있음 |
| `submit_visual`                     | 시각화 HTML          | 주의: `/api/tasks/:id/visual` 라우트가 없을 수 있음                                           |
| `save_artifacts` / `load_artifacts` | 산출물 저장/조회     | 주의: `/api/tasks/:id/artifacts` 라우트가 없을 수 있음                                        |

## 7. 자주 묻는 질문

- "왜 내 findings 가 안 들어가나요?"
  - 권한(RBAC) 이슈가 대부분입니다. `save_findings`(POST `/api/tasks/:id/findings`)는 `tasks:execute` 권한이 필요하므로 `viewer` 계정은 쓸 수 없습니다. `editor` 이상으로 재발급된 API 키를 사용하세요.
- "scan_repo가 왜 서버 측이 아닌가요?"
  - REST 백엔드는 엔드유저의 파일시스템을 볼 수 없습니다. 업로드/클론 모델 없이 결정적으로 스캔하려면, 에이전트 로컬에서 실행하는 예외가 필요합니다.
- "워크플로 버전을 어떻게 관리하나요?"
  - `update_workflow(create_new_version=true)`로 새 버전을 발행하고, `family_root_id`로 같은 family를 묶습니다. 활성 버전은 family당 1개(`is_active=true`)만 유지됩니다.
