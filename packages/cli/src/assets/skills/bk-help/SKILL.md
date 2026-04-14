---
name: bk-help
description: BlueKiwi help skill. Shows a formatted list of all available bk-* commands with descriptions and usage examples. Use when the user says "/bk-help", "bk help", "what bk commands are there", or asks about BlueKiwi commands.
user_invocable: true
---

# BlueKiwi Help

Detect the user's language and output the matching section below **exactly as formatted** (render as readable text, not a code block).

**Language detection — check in this order, use the first signal found:**

1. **Conversation language**: the language the user wrote the current message in
2. **System locale**: run `echo $LANG` or `locale` in shell — use the language portion (e.g. `ko` from `ko_KR.UTF-8`, `en` from `en_US.UTF-8`)
3. **OS language**: check `defaults read -g AppleLanguages 2>/dev/null` (macOS) or `/etc/locale.conf` (Linux)
4. **Fallback**: English

Map detected language to output:

- `ko` / `ko_KR` → **Korean** section
- Anything else → **English** section

---

## Korean output

## BlueKiwi 명령어 도움말

### 실행

| 명령어                           | 설명                                                | 사용 예시                               |
| -------------------------------- | --------------------------------------------------- | --------------------------------------- |
| `/bk-start`                      | 워크플로 선택 후 즉시 실행. 미완료 태스크 복구 포함 | `/bk-start`                             |
| `/bk-start <이름>`               | 이름으로 워크플로 매칭 후 바로 실행                 | `/bk-start 시장조사`                    |
| `/bk-start <ID>`                 | 워크플로 ID로 바로 실행 (숫자)                      | `/bk-start 42`                          |
| `/bk-start #<태스크ID>`          | 특정 태스크 직접 재개                               | `/bk-start #108`                        |
| `/bk-start <이름> :: <프롬프트>` | 워크플로 지정 + 초기 컨텍스트 전달                  | `/bk-start 코드리뷰 :: PR #77 리뷰해줘` |
| `/bk-next`                       | 실행 중인 태스크를 찾아 현재 스텝부터 재개          | `/bk-next`                              |
| `/bk-approve`                    | 대기 중인 HITL 승인 처리                            | `/bk-approve`                           |
| `/bk-rewind`                     | 이전 스텝으로 되돌리기                              | `/bk-rewind`                            |

### 설계 / 관리

| 명령어            | 설명                                              | 사용 예시                                         |
| ----------------- | ------------------------------------------------- | ------------------------------------------------- |
| `/bk-design`      | 자연어 목표로 새 워크플로 설계 및 등록            | `/bk-design 경쟁사 분석 워크플로 만들어줘`        |
| `/bk-import`      | GitHub / 로컬 스킬 / URL을 분석해 워크플로로 변환 | `/bk-import yamadashy/repomix`                    |
|                   |                                                   | `/bk-import bk-design`                            |
|                   |                                                   | `/bk-import https://example.com/runbook`          |
|                   |                                                   | `/bk-import` (대화형 — 텍스트·JSON 붙여넣기 포함) |
| `/bk-improve`     | 기존 워크플로 분석 후 개선 버전 생성              | `/bk-improve 시장조사`                            |
| `/bk-version`     | 버전 목록 조회, 활성화/비활성화, 버전 비교        | `/bk-version`                                     |
| `/bk-instruction` | 에이전트 인스트럭션 템플릿 생성·수정·삭제         | `/bk-instruction`                                 |
| `/bk-credential`  | 외부 서비스 API 키 등록·수정·삭제                 | `/bk-credential`                                  |

### 조회 / 공유

| 명령어       | 설명                               | 사용 예시                       |
| ------------ | ---------------------------------- | ------------------------------- |
| `/bk-status` | 실행 중·완료된 태스크 현황 조회    | `/bk-status`                    |
| `/bk-report` | 태스크 결과 구조화 리포트 생성     | `/bk-report`                    |
| `/bk-share`  | 워크플로·폴더를 그룹에 공유        | `/bk-share 시장조사 → 마케팅팀` |
| `/bk-scan`   | 로컬 저장소 보안·컴플라이언스 스캔 | `/bk-scan`                      |

---

**팁:**

- `/bk-start`는 `/bk-run`의 상위 호환입니다 — 두 명령어 모두 동작합니다.
- 태스크 재개가 필요하면 `/bk-start` (인자 없음) 또는 `/bk-start #<태스크ID>`를 사용하세요.
- 도움말은 언제든 `/bk-help`로 다시 볼 수 있습니다.

---

## English output

## BlueKiwi Command Reference

### Execution

| Command                        | Description                                            | Example                                  |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------- |
| `/bk-start`                    | Pick a workflow and run it. Recovers incomplete tasks. | `/bk-start`                              |
| `/bk-start <name>`             | Match workflow by name and run immediately             | `/bk-start market-research`              |
| `/bk-start <ID>`               | Run workflow by numeric ID                             | `/bk-start 42`                           |
| `/bk-start #<taskID>`          | Resume a specific task directly                        | `/bk-start #108`                         |
| `/bk-start <name> :: <prompt>` | Specify workflow + pass initial context                | `/bk-start code-review :: review PR #77` |
| `/bk-next`                     | Find the active task and resume from the current step  | `/bk-next`                               |
| `/bk-approve`                  | Process a pending HITL approval                        | `/bk-approve`                            |
| `/bk-rewind`                   | Roll back to the previous step                         | `/bk-rewind`                             |

### Design / Management

| Command           | Description                                                         | Example                                               |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `/bk-design`      | Design and register a new workflow from a natural language goal     | `/bk-design build a competitor analysis workflow`     |
| `/bk-import`      | Analyze a GitHub repo / local skill / URL and convert to a workflow | `/bk-import yamadashy/repomix`                        |
|                   |                                                                     | `/bk-import bk-design`                                |
|                   |                                                                     | `/bk-import https://example.com/runbook`              |
|                   |                                                                     | `/bk-import` (interactive — includes text/JSON paste) |
| `/bk-improve`     | Analyze an existing workflow and generate an improved version       | `/bk-improve market-research`                         |
| `/bk-version`     | List versions, activate/deactivate, compare versions                | `/bk-version`                                         |
| `/bk-instruction` | Create, edit, or delete agent instruction templates                 | `/bk-instruction`                                     |
| `/bk-credential`  | Register, edit, or delete external service API keys                 | `/bk-credential`                                      |

### Monitoring / Sharing

| Command      | Description                                        | Example                                      |
| ------------ | -------------------------------------------------- | -------------------------------------------- |
| `/bk-status` | View running and completed task status             | `/bk-status`                                 |
| `/bk-report` | Generate a structured report from task results     | `/bk-report`                                 |
| `/bk-share`  | Share a workflow or folder with a group            | `/bk-share market-research → marketing-team` |
| `/bk-scan`   | Run a security and compliance scan on a local repo | `/bk-scan`                                   |

---

**Tips:**

- `/bk-start` is a superset of `/bk-run` — both commands work.
- To resume a task, use `/bk-start` (no args) or `/bk-start #<taskID>`.
- Run `/bk-help` anytime to see this reference again.
