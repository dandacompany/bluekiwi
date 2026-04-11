<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI 에이전트 워크플로우 엔진**

재사용 가능한 워크플로우를 설계하고, 어떤 AI 에이전트에서든 실행하며, 모든 단계를 실시간으로 확인하세요.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

[빠른 시작](#빠른-시작) · [사용법](#사용법) · [기능](#기능) · [MCP 도구](#mcp-도구) · [CLI](#cli) · [설정](#설정) · [트러블슈팅](#트러블슈팅)

</div>

---

## BlueKiwi란?

BlueKiwi는 **멀티스텝 에이전트 지시를 재사용 가능한 워크플로우로 만드는** 셀프호스팅 서버입니다.

웹 UI에서 워크플로우를 한 번 만들면, 연결된 어떤 AI 에이전트(Claude Code, Codex, Gemini CLI 등)든 해당 워크플로우를 시작하고, 단계를 실행하고, 사람의 입력을 기다리고, 완료할 수 있습니다 — 팀 전체가 브라우저에서 실시간 타임라인으로 확인하면서요.

```
입력:  /bk-start "코드 리뷰"

에이전트 ──▶ BlueKiwi MCP ──▶ BlueKiwi 서버 ──▶ 웹 UI (실시간 타임라인)
             list_workflows      로그 저장          브라우저
             start_workflow      RBAC 적용          댓글 / 아티팩트
             execute_step        출력 저장
```

**프롬프트를 매번 복붙하는 일은 이제 그만.** 검증된 에이전트 워크플로우가 팀의 자산이 됩니다.

---

## 빠른 시작

### 옵션 1 — Docker (권장)

```bash
mkdir bluekiwi && cd bluekiwi

# docker-compose와 환경변수 템플릿 다운로드
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/dandacompany/bluekiwi/main/.env.example -o .env

# .env 편집 → DB_PASSWORD, JWT_SECRET 반드시 설정

docker compose up -d
```

**http://localhost:3100** 접속 → `/setup` 페이지 완료 → **슈퍼유저** 계정 생성 완료.

> Next.js(`3100`), PostgreSQL, Redis가 Docker 내부에서 함께 실행됩니다. 포트는 `APP_PORT`로 변경 가능합니다.

### 옵션 2 — 관리형 플랫폼

[`deploy/`](./deploy/) 디렉토리에 원클릭 배포 템플릿이 있습니다:

| 플랫폼           |                         |
| ---------------- | ----------------------- |
| Railway          | `deploy/railway.json`   |
| Fly.io           | `deploy/fly.toml`       |
| Render           | `deploy/render.yaml`    |
| DigitalOcean App | `deploy/do-app.yaml`    |
| Dokku            | `deploy/dokku-setup.sh` |

---

## 사용법

### 1. 최초 설정 (슈퍼유저)

서버가 시작되면 브라우저에서 **`/setup`** 페이지에 접속합니다. 이 초기 설정 마법사에서 슈퍼유저 계정을 생성합니다. `/setup` 페이지는 최초 계정이 생성되기 전까지만 접근 가능합니다.

초대 토큰 없이 CLI에서 직접 연결하려면 (슈퍼유저 / 관리자 사용):

```bash
npm install -g bluekiwi

# 기존 API 키로 연결
bluekiwi init --server https://your-bluekiwi-server.example.com --api-key bk_...
```

### 2. 팀원 초대

**Settings → Team** 에서 팀원별 초대 링크 또는 토큰을 생성합니다. 초대 생성 시 역할을 지정합니다.

### 3. 팀원이 초대 수락

```bash
# CLI 설치
npm install -g bluekiwi

# 초대 수락 (대화형: 사용자명 + 비밀번호 입력 후 런타임 선택)
bluekiwi accept <token> --server https://your-bluekiwi-server.example.com

# 연결 확인
bluekiwi status
```

`accept` 명령어 실행 순서:

1. 초대 토큰 유효성 검사
2. 사용자명과 비밀번호 입력 안내
3. 서버에 계정 생성 및 API 키 발급
4. 사용자 PC에 설치된 에이전트 런타임 자동 감지
5. 선택한 런타임에 BlueKiwi MCP 서버와 스킬 설치
6. 인증 정보를 `~/.bluekiwi/config.json`에 저장

**비대화형 / CI 모드** — 플래그 또는 환경변수로 프롬프트 생략:

```bash
bluekiwi accept <token> --server <url> --username alice --password secret
```

### 4. 에이전트에서 워크플로우 사용

Claude Code(또는 지원되는 런타임)에서 다음 슬래시 커맨드를 사용할 수 있습니다:

| 커맨드                 | 설명                           |
| ---------------------- | ------------------------------ |
| `/bk-start <workflow>` | 이름 또는 ID로 워크플로우 시작 |
| `/bk-next`             | 다음 단계로 진행               |
| `/bk-status`           | 현재 태스크 진행 상태 확인     |
| `/bk-rewind <step>`    | 이전 단계로 되돌아가기         |

**사용 예시:**

```
사용자:  /bk-start "백엔드 코드 리뷰"

에이전트: 워크플로우 "Backend Code Review" 시작 (총 6단계)
          1/6단계 — 변경된 파일을 읽고 범위 요약
          [... 실행 중 ...]
          2/6단계 — 보안 이슈 점검
          ⏸ Gate: 검토 후 계속 진행 승인이 필요합니다.

사용자:  /bk-next

에이전트: 3/6단계 — 성능 분석
          [... 계속 ...]
```

에이전트가 실행되는 동안 팀은 `https://your-server/tasks/{id}` 에서 단계별 구조화된 출력, 댓글, 아티팩트를 실시간으로 확인할 수 있습니다.

### 5. 워크플로우 직접 만들기

웹 UI → **Workflows → New Workflow** → Cmd+K 노드 피커로 단계 추가.

세 가지 단계 유형:

- **Action** — 에이전트가 자율적으로 실행
- **Gate** — 사람의 승인을 기다리고 계속 진행
- **Loop** — 조건을 만족할 때까지 반복

각 단계에는 **지시(instruction)** 필드(에이전트가 수행할 내용)와 선택적 **구조화된 출력 스키마**(단계 완료 시 에이전트가 채워야 하는 JSON 스키마)가 있습니다.

---

## 기능

### 실시간 타임라인

모든 태스크 실행이 단계별로 추적됩니다. 각 단계에서 확인 가능한 항목:

- **Thinking** — 에이전트의 추론 과정
- **Output** — 어시스턴트 응답 결과
- **User input** — Gate 단계에서 사람이 입력한 내용
- **Artifacts** — 에이전트가 저장한 파일
- **Comments** — 해당 단계에 대한 팀의 코멘트

### 워크플로우 에디터

- 드래그 앤 드롭으로 단계 순서 변경
- **Cmd+K** 노드 피커 — 저장된 지시 템플릿 검색
- 가로 미니맵 — 전체 파이프라인 한눈에 보기
- 버전 히스토리 — 모든 편집은 비파괴적으로 저장

### 멀티 런타임 지원

| 런타임      | `bluekiwi accept`로 자동 설정되는 경로 |
| ----------- | -------------------------------------- |
| Claude Code | `~/.claude/mcp.json`                   |
| Codex CLI   | `~/.codex/config.toml`                 |
| Gemini CLI  | `~/.gemini/settings.json`              |
| OpenCode    | `~/.opencode/mcp.json`                 |
| OpenClaw    | `~/.openclaw/mcp.json`                 |

설치 후 BlueKiwi는 내장 스킬(예: `/bk-start`)을 각 런타임의 스킬 디렉토리에 복사하여 슬래시 커맨드로 즉시 사용할 수 있게 합니다.

### 보안 & RBAC

- **4단계 역할**: `superuser` → `admin` → `editor` → `viewer`
- **API 키**: `bk_` 접두사, SHA-256 해시, 만료 및 취소 지원
- **기본 자격증명 없음** — 첫 방문자가 `/setup`에서 슈퍼유저 계정 생성
- MCP 서버는 **DB에 직접 접근하지 않음** — 모든 요청은 인증된 REST API를 통해 처리

### 다국어 지원

한국어 / 영어 전환이 내장되어 있습니다. `src/lib/i18n/`에 JSON 파일을 추가해 언어를 확장할 수 있습니다.

---

## MCP 도구

`bluekiwi` MCP 서버는 에이전트 런타임이 호출할 수 있는 16개 도구를 제공합니다:

| 도구               | 설명                             |
| ------------------ | -------------------------------- |
| `list_workflows`   | 사용 가능한 워크플로우 목록 조회 |
| `start_workflow`   | 워크플로우 시작 → 태스크 생성    |
| `execute_step`     | 현재 단계 출력 저장              |
| `advance`          | 다음 단계로 이동                 |
| `heartbeat`        | 진행 상태 핑 (keep-alive)        |
| `complete_task`    | 태스크 완료 처리                 |
| `rewind`           | 이전 단계로 되돌아가기           |
| `get_web_response` | URL 가져오기 (Gate 단계용)       |
| `submit_visual`    | 스크린샷/이미지 첨부             |
| `save_artifacts`   | 파일을 태스크에 저장             |
| `load_artifacts`   | 이전에 저장한 파일 불러오기      |
| `get_comments`     | 단계별 팀 코멘트 읽기            |
| `list_credentials` | 저장된 API 시크릿 목록 조회      |
| `create_workflow`  | API로 새 워크플로우 생성         |
| `update_workflow`  | 기존 워크플로우 수정             |
| `delete_workflow`  | 워크플로우 삭제                  |

**MCP 서버 직접 실행** (테스트 또는 커스텀 연동):

```bash
cd mcp && npm install && npm run build
BLUEKIWI_API_URL=https://your-server.example.com \
BLUEKIWI_API_KEY=bk_... \
node dist/server.js
```

전체 OpenAPI 스펙은 실행 중인 서버의 **`/docs`** (Swagger UI)에서 확인할 수 있습니다.

---

## CLI

### 설치

```bash
npm install -g bluekiwi
```

### 커맨드 목록

| 커맨드                            | 설명                                          |
| --------------------------------- | --------------------------------------------- |
| `bluekiwi accept <token>`         | 팀 초대 수락 및 런타임 설정                   |
| `bluekiwi init`                   | 기존 API 키로 직접 연결 (초대 불필요)         |
| `bluekiwi status`                 | 연결 상태 및 현재 사용자 정보 확인            |
| `bluekiwi workflows`              | 사용 가능한 워크플로우 목록                   |
| `bluekiwi run <workflow-id>`      | 워크플로우 실행 (태스크 ID와 웹 UI 링크 출력) |
| `bluekiwi runtimes list`          | 지원 런타임 목록 및 설치 상태 확인            |
| `bluekiwi runtimes add <name>`    | 추가 런타임에 BlueKiwi 설치                   |
| `bluekiwi runtimes remove <name>` | 런타임에서 BlueKiwi 제거                      |
| `bluekiwi logout`                 | 로그아웃 및 모든 런타임에서 제거              |
| `bluekiwi upgrade`                | CLI 최신 버전으로 업그레이드 및 에셋 갱신     |

**`bluekiwi accept`** — 전체 플래그:

```bash
bluekiwi accept <token> \
  --server   <url>        # BlueKiwi 서버 URL (필수)
  --username <name>       # 사용자명 입력 프롬프트 생략
  --password <pass>       # 비밀번호 입력 프롬프트 생략
```

**`bluekiwi init`** — API 키로 직접 연결 (관리자 / 슈퍼유저 워크플로우):

```bash
bluekiwi init \
  --server  <url>    # 또는 환경변수 BLUEKIWI_SERVER
  --api-key <key>    # 또는 환경변수 BLUEKIWI_API_KEY
  --runtime <name>   # 여러 번 반복 가능; 또는 환경변수 BLUEKIWI_RUNTIMES=claude-code,codex
  --yes              # 비대화형 (감지된 런타임 자동 선택)
```

---

## 설정

### `~/.bluekiwi/config.json`

`bluekiwi accept` 또는 `bluekiwi init` 실행 후 인증 정보가 저장되는 위치:

```
~/.bluekiwi/config.json   (mode 0600 — 소유자만 읽기/쓰기)
~/.bluekiwi/              (mode 0700 — 소유자만 접근)
```

파일 구조:

```json
{
  "version": "1.0.0",
  "server_url": "https://your-bluekiwi-server.example.com",
  "api_key": "bk_...",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "editor"
  },
  "runtimes": ["claude-code", "codex"],
  "installed_at": "2026-01-01T00:00:00.000Z",
  "last_used": "2026-01-01T00:00:00.000Z"
}
```

현재 설정 확인:

```bash
cat ~/.bluekiwi/config.json
# 또는
bluekiwi status
```

로그아웃 및 인증 정보 삭제:

```bash
bluekiwi logout
```

### 런타임별 MCP 설정 파일

`bluekiwi accept` / `bluekiwi init` 실행 시 각 런타임의 설정 파일에 MCP 서버 항목이 자동으로 추가됩니다:

| 런타임      | 수정되는 설정 파일        |
| ----------- | ------------------------- |
| Claude Code | `~/.claude/mcp.json`      |
| Codex CLI   | `~/.codex/config.toml`    |
| Gemini CLI  | `~/.gemini/settings.json` |
| OpenCode    | `~/.opencode/mcp.json`    |
| OpenClaw    | `~/.openclaw/mcp.json`    |

주입되는 항목은 번들된 `node dist/server.js`를 다음 두 환경변수와 함께 실행합니다:

```
BLUEKIWI_API_URL  = 서버 URL
BLUEKIWI_API_KEY  = API 키
```

처음 `accept` 실행 시 설치되지 않은 런타임을 추가하려면:

```bash
# 먼저 해당 런타임을 설치한 후
bluekiwi runtimes add codex
```

설치 및 활성화된 런타임 확인:

```bash
bluekiwi runtimes list
```

---

## 트러블슈팅

**"Not authenticated" 오류**

```
Error: Not authenticated. Run `npx bluekiwi accept <token> --server <url>` first.
```

`~/.bluekiwi/config.json` 파일이 없거나 손상되었습니다. `bluekiwi accept` 또는 `bluekiwi init`을 다시 실행하세요.

---

**`bluekiwi status`에서 "Connection failed"**

서버에 접근할 수 없거나 API 키가 취소된 상태입니다. 다음을 확인하세요:

- `~/.bluekiwi/config.json`의 서버 URL이 올바른지
- 서버가 실행 중인지 (`docker compose ps`)
- API 키가 만료되거나 취소되지 않았는지 (웹 UI → **Settings → API Keys**)

---

**`bluekiwi accept`에서 런타임이 감지되지 않음**

CLI는 설치 시점에 런타임 바이너리를 확인합니다. `bluekiwi accept` 실행 후 새 에이전트 런타임을 설치했다면 수동으로 추가하세요:

```bash
bluekiwi runtimes add claude-code   # 또는: codex, gemini-cli, opencode, openclaw
```

---

**Claude Code에서 슬래시 커맨드가 보이지 않음**

BlueKiwi는 스킬 파일을 `~/.claude/skills/`에 설치합니다. 파일이 없다면 재설치하세요:

```bash
bluekiwi runtimes remove claude-code
bluekiwi runtimes add claude-code
```

---

**CLI 업그레이드**

```bash
bluekiwi upgrade
# 내부 동작: npm install -g bluekiwi@latest + 모든 런타임에 에셋 재설치
```

---

## 기여하기

이슈와 PR을 환영합니다. 개발 환경 설정, 아키텍처, DB 스키마는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

```bash
# 로컬 개발 스택 (핫 리로드)
git clone https://github.com/dandacompany/bluekiwi.git
cd bluekiwi
bash scripts/dev.sh start
```

---

## 라이선스

MIT — [LICENSE](LICENSE) 참고.  
Copyright © 2026 Dante Labs.

---

<div align="center">

**YouTube** [@dante-labs](https://youtube.com/@dante-labs) · **이메일** dante@dante-labs.com · [☕ 커피 후원](https://buymeacoffee.com/dante.labs)

</div>
