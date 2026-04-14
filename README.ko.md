<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI 에이전트 워크플로우 엔진**

재사용 가능한 워크플로우를 설계하고, 어떤 AI 코딩 에이전트에서든 실행하며, 모든 단계를 실시간으로 확인하세요.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License](https://img.shields.io/badge/License-Sustainable_Use-lightgrey)](LICENSE.md)

[빠른 시작](#빠른-시작) · [스킬](#스킬) · [MCP 도구](#mcp-도구) · [CLI](#cli) · [셀프호스팅](#셀프호스팅) · [기여하기](#기여하기)

🌐 [English](README.md) · 📊 [프레젠테이션 슬라이드](https://canva.link/5f62nmx6wk7x4ka)

</div>

---

## BlueKiwi란?

BlueKiwi는 **AI 코딩 에이전트를 위한 셀프호스팅 워크플로우 엔진**입니다. 웹 UI에서 멀티스텝 워크플로우를 한 번 설계하면, 연결된 에이전트(Claude Code, Codex CLI, Gemini CLI 등)가 언제든 실행할 수 있습니다 — 모든 단계가 실시간 타임라인으로 기록됩니다.

```
입력:  /bk-start "백엔드 코드 리뷰"

에이전트 ──▶ BlueKiwi MCP ──▶ BlueKiwi 서버 ──▶ 웹 UI (실시간 타임라인)
             list_workflows      로그 저장          브라우저
             start_workflow      RBAC 적용          댓글 / 승인
             execute_step        출력 저장
             advance
```

**프롬프트를 매번 복붙하는 일은 이제 그만.** 검증된 에이전트 워크플로우가 팀의 재사용 자산이 됩니다.

---

## 빠른 시작

### 사전 요구사항

- Docker + Docker Compose

### 1. Compose 파일 다운로드

```bash
mkdir bluekiwi && cd bluekiwi
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/.env.example -o .env
```

### 2. `.env` 설정

`.env`를 열어 두 가지 필수 값을 입력합니다:

```bash
# 생성 방법: openssl rand -hex 16
DB_PASSWORD=강력한_비밀번호

# 생성 방법: openssl rand -hex 32
JWT_SECRET=JWT_시크릿
```

### 3. 시작

```bash
docker compose up -d
```

**http://localhost:3100/setup** 접속 → 슈퍼유저 계정 생성. `/setup` 페이지는 최초 계정 생성 전까지만 접근 가능합니다.

> Next.js 앱(`3100`포트), PostgreSQL 16, Redis 7이 Docker 내에서 함께 실행됩니다. 포트는 `APP_PORT`로 변경 가능합니다.

### 4. CLI 설치

```bash
npm install -g bluekiwi
```

**방법 A — 초대 수락 (신규 팀원 권장)**

**Settings → Team**에서 초대 토큰을 생성한 후:

```bash
bluekiwi accept <token> --server http://localhost:3100
```

초대 유효성 검사 → 계정 생성 → API 키 발급 → 설치된 에이전트 런타임 자동 감지 → MCP 서버 및 스킬 설치까지 자동으로 진행됩니다.

**방법 B — 기존 API 키로 init (superuser / admin)**

이미 계정이 있는 경우(예: `/setup`으로 생성한 superuser), **Settings → API Keys**에서 키를 발급한 후:

```bash
bluekiwi init --server http://localhost:3100 --api-key bk_xxxx
```

서버 연결 확인 → 설치된 런타임 자동 감지 → MCP 서버 및 스킬 설치까지 자동으로 진행됩니다.

---

## 스킬

`bluekiwi accept` 완료 후 Claude Code(및 지원 런타임)에서 아래 슬래시 커맨드를 사용할 수 있습니다:

| 커맨드                   | 설명                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `/bk-start [워크플로우]` | 워크플로우 시작 또는 재개. 세션 복원, timed-out 태스크, HITL 게이트를 인라인으로 처리합니다. |
| `/bk-design [목표]`      | 자연어 설명으로 새 워크플로우를 설계하고 서버에 등록합니다.                                  |
| `/bk-approve`            | 세션 재개 시 대기 중인 HITL 단계를 승인합니다.                                               |
| `/bk-improve`            | 완료된 태스크를 분석해 워크플로우 개선안을 제안합니다.                                       |
| `/bk-report`             | 완료된 태스크에 대한 구조화된 리포트를 생성합니다.                                           |
| `/bk-instruction`        | 지시 템플릿 라이브러리에서 항목을 생성하거나 수정합니다.                                     |
| `/bk-rewind`             | 현재 태스크를 이전 단계로 되돌립니다.                                                        |
| `/bk-status`             | 현재 태스크 진행 상태와 단계 세부 정보를 표시합니다.                                         |
| `/bk-version`            | 현재 워크플로우 버전을 확인하거나 전환합니다.                                                |
| `/bk-credential`         | 에이전트가 사용할 수 있는 크리덴셜을 조회하거나 생성합니다.                                  |
| `/bk-scan`               | 로컬 리포지토리에 컴플라이언스 패턴 스캔을 실행합니다.                                       |
| `/bk-share`              | 폴더를 사용자 그룹과 공유합니다.                                                             |

**사용 예시:**

```
사용자:  /bk-start "백엔드 코드 리뷰"

에이전트: → "Backend Code Review" 시작 (총 6단계)
            1/6단계 — 범위 요약
            [실행 중 ...]
            2/6단계 — 보안 점검
            ⏸  Gate: 검토 후 계속 진행 승인이 필요합니다.
            [대기 중]

사용자:  /bk-approve

에이전트: → 승인됨. 3/6단계 — 성능 분석 ...
```

에이전트가 실행되는 동안 **`http://localhost:3100/tasks/{id}`** 에서 실시간 타임라인을 확인하세요.

---

## 워크플로우 빌더

웹 UI → **Workflows → New** → 단계 추가.

### 노드 타입

| 타입       | 동작                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Action** | 에이전트가 자율적으로 실행하고 자동으로 다음 단계로 넘어갑니다.                                                                                                                                                       |
| **Gate**   | 에이전트가 멈추고 다음 `/bk-start` 호출이나 사람의 신호를 기다립니다. **Visual Selection**을 활성화하면 에이전트가 작성한 클릭 기반 HTML UI(bk-options, bk-checklist, bk-slider 등)가 팝업 다이얼로그로 렌더링됩니다. |
| **Loop**   | 조건을 만족할 때까지 단계를 반복한 후 앞으로 이동합니다.                                                                                                                                                              |

### HITL (Human-in-the-Loop)

**Action** 노드에 `hitl=true`를 설정하면 에이전트가 다음 단계로 넘어가기 전에 명시적인 사람의 승인이 필요합니다. 에이전트는 `request_approval`을 호출하고 대기하며, 사람이 웹 UI에서 출력을 확인한 후 **승인** 버튼을 클릭합니다.

### 태스크 라이프사이클

```
pending → running → completed
                  → failed
                  → timed_out   (2시간 이상 비활성; /bk-start에서 재개 제안)
```

태스크는 웹 UI 또는 `/bk-rewind`로 이전 단계로 **되돌릴** 수 있습니다.

---

## MCP 도구

`bluekiwi` MCP 서버는 에이전트 런타임이 자동으로 호출하는 도구를 제공합니다. 전체 레퍼런스는 실행 중인 서버의 **`/docs`** (Swagger UI + OpenAPI JSON)에서 확인하세요.

### 워크플로우 실행

| 도구             | 설명                                                 |
| ---------------- | ---------------------------------------------------- |
| `list_workflows` | 현재 사용자에게 보이는 워크플로우 목록 조회          |
| `start_workflow` | 워크플로우로 태스크 시작                             |
| `execute_step`   | 현재 단계의 출력 제출                                |
| `advance`        | 다음 단계로 이동 (`peek=true`로 현재 단계 확인 가능) |
| `heartbeat`      | 단계 진행 핑 (keep-alive)                            |
| `complete_task`  | 태스크를 완료 또는 실패로 표시                       |
| `rewind`         | 이전 단계로 되돌아가기                               |

### Visual Selection

| 도구               | 설명                                                    |
| ------------------ | ------------------------------------------------------- |
| `set_visual_html`  | visual_selection 게이트 노드에 bk-\* 컴포넌트 HTML 작성 |
| `get_web_response` | 사용자가 VS 다이얼로그 제출 후 클릭 응답 가져오기       |
| `submit_visual`    | 단계에 렌더링된 HTML 첨부 (저수준 대안)                 |

### 사람 승인 (HITL)

| 도구               | 설명                                                 |
| ------------------ | ---------------------------------------------------- |
| `request_approval` | 에이전트가 진행하기 전에 사람의 승인이 필요함을 알림 |
| `approve_step`     | 현재 HITL 단계 승인 (`/bk-approve`에서만 호출)       |

### 태스크 데이터

| 도구                                | 설명                                             |
| ----------------------------------- | ------------------------------------------------ |
| `list_tasks`                        | 태스크 목록 조회 (상태, 워크플로우, 검색어 필터) |
| `get_comments`                      | 단계별 팀 코멘트 조회                            |
| `save_artifacts` / `load_artifacts` | 파일 또는 참조를 태스크에 저장하거나 불러오기    |
| `save_feedback`                     | 워크플로우 완료 후 피드백 설문 응답 저장         |
| `save_findings` / `list_findings`   | 컴플라이언스 스캔 결과 저장 또는 조회            |

### 워크플로우 관리

| 도구                                                          | 설명                               |
| ------------------------------------------------------------- | ---------------------------------- |
| `create_workflow` / `update_workflow` / `delete_workflow`     | 전체 CRUD                          |
| `list_workflow_versions`                                      | 워크플로우 패밀리의 모든 버전 조회 |
| `activate_workflow` / `deactivate_workflow`                   | 활성 버전 전환                     |
| `append_node` / `insert_node` / `update_node` / `remove_node` | 노드 단위 CRUD                     |

### 첨부 파일

| 도구                                      | 설명                                 |
| ----------------------------------------- | ------------------------------------ |
| `list_attachments` / `get_attachment`     | 노드 파일 첨부 목록 조회 및 다운로드 |
| `upload_attachment` / `delete_attachment` | 텍스트 파일 첨부 추가 또는 삭제      |

### 지시 & 크리덴셜

| 도구                                                                                     | 설명                   |
| ---------------------------------------------------------------------------------------- | ---------------------- |
| `list_instructions` / `create_instruction` / `update_instruction` / `delete_instruction` | 지시 템플릿 라이브러리 |
| `list_credentials` / `create_credential` / `update_credential` / `delete_credential`     | 크리덴셜 저장소        |

### 폴더 & 공유

| 도구                                 | 설명                                     |
| ------------------------------------ | ---------------------------------------- |
| `list_folders` / `create_folder`     | 폴더 조회 및 생성                        |
| `share_folder` / `unshare_folder`    | 사용자 그룹과 폴더 공유                  |
| `move_workflow` / `move_instruction` | 항목을 다른 폴더로 이동                  |
| `transfer_workflow`                  | 워크플로우 소유권을 다른 사용자에게 이전 |
| `list_my_groups`                     | 현재 사용자가 속한 그룹 목록 조회        |

### 컴플라이언스

| 도구        | 설명                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `scan_repo` | 로컬 파일시스템 정적 패턴 스캔 (REST를 거치지 않고 인-프로세스 실행) |

---

## CLI

```bash
npm install -g bluekiwi
```

| 커맨드                                         | 설명                                          |
| ---------------------------------------------- | --------------------------------------------- |
| `bluekiwi accept <token> --server <url>`       | 팀 초대 수락 및 에이전트 런타임 설정          |
| `bluekiwi init --server <url> --api-key <key>` | 기존 API 키로 직접 연결 (슈퍼유저 / 관리자)   |
| `bluekiwi status`                              | 연결 상태 및 현재 사용자 정보 확인            |
| `bluekiwi runtimes list`                       | 지원 런타임 목록 및 설치 상태 확인            |
| `bluekiwi runtimes add <name>`                 | 추가 런타임에 BlueKiwi 설치                   |
| `bluekiwi runtimes remove <name>`              | 런타임에서 BlueKiwi 제거                      |
| `bluekiwi logout`                              | 로그아웃 및 모든 크리덴셜 삭제                |
| `bluekiwi upgrade`                             | CLI 업그레이드 및 모든 런타임의 MCP 에셋 갱신 |

**지원 런타임:**

| 런타임      | 주입되는 설정 파일        |
| ----------- | ------------------------- |
| Claude Code | `~/.claude/mcp.json`      |
| Codex CLI   | `~/.codex/config.toml`    |
| Gemini CLI  | `~/.gemini/settings.json` |
| OpenCode    | `~/.opencode/mcp.json`    |
| OpenClaw    | `~/.openclaw/mcp.json`    |

연결 완료 후 BlueKiwi는 내장 스킬을 각 런타임의 스킬 디렉토리에 복사하여 슬래시 커맨드를 즉시 사용할 수 있게 합니다.

---

## 셀프호스팅

### 환경 변수

| 변수               | 필수 | 기본값                  | 설명                                                 |
| ------------------ | ---- | ----------------------- | ---------------------------------------------------- |
| `DB_PASSWORD`      | ✅   | —                       | PostgreSQL 비밀번호                                  |
| `JWT_SECRET`       | ✅   | —                       | JWT 서명 시크릿 (최소 32자)                          |
| `APP_PORT`         |      | `3100`                  | 웹 UI 호스트 포트                                    |
| `TEAM_NAME`        |      | —                       | UI 메타데이터와 사이드바 브랜딩에 표시할 선택적 팀명 |
| `PUBLIC_URL`       |      | `http://localhost:3100` | 초대 링크에 표시되는 공개 URL                        |
| `BLUEKIWI_VERSION` |      | `latest`                | 특정 이미지 태그 고정                                |
| `RESEND_API_KEY`   |      | —                       | 초대 이메일 발송 활성화                              |
| `FROM_EMAIL`       |      | —                       | 초대 이메일 발신자 주소                              |

### 원클릭 배포

| 플랫폼           | 템플릿                         |
| ---------------- | ------------------------------ |
| Railway          | `deploy/railway.json`          |
| Fly.io           | `deploy/fly.toml`              |
| Render           | `deploy/render.yaml`           |
| DigitalOcean App | `deploy/digitalocean-app.yaml` |
| Dokku            | `deploy/dokku/`                |

### 데이터베이스 마이그레이션

앱 시작 시 마이그레이션이 자동으로 실행됩니다. 신규 설치의 경우 Docker가 `docker/init.sql`을 자동으로 로드하여 전체 스키마를 생성하고 초기 마이그레이션을 적용된 것으로 표시합니다 — 별도의 수동 작업이 필요하지 않습니다.

CI 파이프라인 등에서 수동으로 마이그레이션을 실행하려면:

```bash
npx tsx scripts/migrate.ts
```

### 업그레이드

새 이미지를 Pull하고 재시작합니다:

```bash
docker compose pull && docker compose up -d
```

다음 앱 시작 시 마이그레이션이 자동으로 실행됩니다.

---

## 보안 & RBAC

- **4단계 역할**: `superuser` → `admin` → `editor` → `viewer`
- **API 키**: `bk_` 접두사, SHA-256 해시, 만료 및 취소 지원
- **폴더**: personal / group / public 가시성, 2단계 계층 구조
- **공유**: 특정 폴더에 그룹별 `reader` 또는 `contributor` 권한 부여
- **기본 자격증명 없음** — 슈퍼유저 계정은 첫 `/setup` 방문 시 생성
- **MCP는 DB 직접 접근 없음** — 모든 호출이 인증된 REST API를 통해 처리

---

## 기여하기

```bash
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
# 앱:  http://localhost:3100
# DB:  localhost:5433
```

아키텍처 설명, 개발 커맨드, 마이그레이션 추가 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

이슈와 PR을 환영합니다.

---

## 라이선스

[Sustainable Use License](LICENSE.md) — 개인 및 내부 비즈니스 용도로 무료.  
상업적 재배포나 SaaS 제공을 위해서는 별도 계약이 필요합니다.  
Copyright © 2026 Dante Labs.

---

<div align="center">

**YouTube** [@dante-labs](https://youtube.com/@dante-labs) · **이메일** dante@dante-labs.com · [☕ 커피 후원](https://buymeacoffee.com/dante.labs)

</div>
