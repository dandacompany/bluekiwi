<div align="center">

<img src="public/icon-192.png" alt="BlueKiwi" width="96" height="96" />

# BlueKiwi

**AI 에이전트 워크플로우 엔진**

재사용 가능한 워크플로우를 설계하고, 어떤 AI 에이전트에서든 실행하며, 모든 단계를 실시간으로 확인하세요.

[![npm](https://img.shields.io/npm/v/bluekiwi?color=4169e1)](https://www.npmjs.com/package/bluekiwi)
[![Docker](https://img.shields.io/badge/ghcr.io-bluekiwi-b7cf57)](https://ghcr.io/dandacompany/bluekiwi)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

[빠른 시작](#빠른-시작) · [사용법](#사용법) · [기능](#기능) · [MCP 도구](#mcp-도구) · [CLI](#cli)

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

### 1. 팀원 초대

설정 완료 후 **Settings → Team** 에서 팀원별 초대 링크 또는 토큰을 생성합니다.

### 2. 팀원이 초대 수락

```bash
# CLI 설치
npm install -g bluekiwi

# 초대 수락 (감지된 에이전트 런타임에 MCP 자동 설정)
bluekiwi accept <token> --server https://your-bluekiwi-server.example.com

# 연결 확인
bluekiwi status
```

`accept` 명령어는 설치된 에이전트 런타임(Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw)을 자동으로 감지하고 BlueKiwi MCP 서버를 등록합니다.

### 3. 에이전트에서 워크플로우 사용

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

### 4. 워크플로우 직접 만들기

웹 UI → **Workflows → New Workflow** → Cmd+K 노드 피커로 단계 추가.

세 가지 단계 유형:

- **Action** — 에이전트가 자율적으로 실행
- **Gate** — 사람의 승인을 기다리고 계속 진행
- **Loop** — 조건을 만족할 때까지 반복

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
node dist/server.js
# 환경변수: BLUEKIWI_API_URL, BLUEKIWI_API_KEY
```

전체 OpenAPI 스펙은 실행 중인 서버의 **`/docs`** (Swagger UI)에서 확인할 수 있습니다.

---

## CLI

```bash
# 팀 초대 수락 및 MCP 설정
bluekiwi accept <token> --server <url>

# 연결 상태 및 현재 사용자 정보 확인
bluekiwi status

# 사용 가능한 워크플로우 목록
bluekiwi workflows

# 워크플로우 실행 (태스크 ID와 웹 UI 링크 출력)
bluekiwi run <workflow-id>
```

설치:

```bash
npm install -g bluekiwi
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
