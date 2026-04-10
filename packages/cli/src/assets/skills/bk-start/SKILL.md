---
name: bk-start
description: BlueKiwi 워크플로 실행 시작 스킬. 서버에 등록된 워크플로를 선택하고 첫 번째 단계를 즉시 실행합니다. This skill should be used when the user says "/bk-start", "워크플로 시작", "BlueKiwi 시작", or wants to begin a registered instruction workflow.
user_invocable: true
---

# BlueKiwi Workflow Start

서버에 등록된 워크플로를 선택하고, 태스크를 생성한 뒤, 첫 번째 단계를 즉시 실행하는 스킬.

## 인자 처리

- `/bk-start` → 워크플로 목록 조회 후 `AskUserQuestion`으로 선택 요청.
- `/bk-start 보안 리뷰` → 주제 매칭된 워크플로를 Recommended로 제안.

## 핵심 원칙

- **instruction은 에이전트의 내부 동작 지침이다. 사용자에게 그대로 노출하지 않는다.**
- "노드", "node_type", "chain_nodes" 등 시스템 용어를 사용자에게 보여주지 않는다.
- 사용자에게는 "단계" 또는 "스텝"으로만 안내한다.
- output은 사용자가 웹 UI에서 읽는 기록이다. **"~했습니다"체로 통일**한다. "~함", "~함." 어투를 쓰지 않는다.

## AskUserQuestion 파라미터 규칙

- `options`는 반드시 2~4개.
- `preview`는 단순 문자열. 줄바꿈은 `\n`.
- `header`는 12자 이내.
- `multiSelect`는 `false`.

## 세션 복원 (미완료 태스크 이어가기)

시작 전에 `curl -s http://localhost:3000/api/tasks`로 running 상태의 태스크가 있는지 확인한다.

미완료 태스크가 있으면 AskUserQuestion으로 물어본다:
- header: "이어가기"
- "진행 중인 태스크 #{id} ({워크플로명}, Step {N}/{total})가 있습니다. 이어서 진행하시겠습니까?"
- 옵션: "이어서 진행 (Recommended)" / "새 워크플로 시작"

이어서 진행을 선택하면 → `advance(task_id, peek=true)` 호출 후 `task_context`를 읽고, `/bk-next` 스킬 로직으로 전환한다.

## execute_step 호출 시 필수 파라미터

<HARD-RULE>
execute_step 호출 시 반드시 아래 파라미터를 채운다:
- `context_snapshot`: JSON 문자열. 이 단계에서 내린 결정사항, 주요 발견, 다음 단계 힌트.
- `agent_id`: 사용 중인 모델명 (예: "claude-opus-4")
- `user_name`: 사용자 이름 (알 수 없으면 생략 가능)

파일을 생성하거나 수정한 경우, `artifacts` 배열에 기록한다:
- 파일 생성: `{artifact_type: "file", title: "설계 문서", file_path: "docs/specs/design.md"}`
- 커밋한 경우: `{artifact_type: "git_commit", title: "구현", git_ref: "커밋해시"}`
</HARD-RULE>

## 세션 메타 수집

<HARD-RULE>
`start_workflow` 호출 전에 반드시 세션 메타 정보를 수집하여 `session_meta` 파라미터로 전달한다.
Bash 도구로 아래 명령을 실행하여 정보를 수집한다:

```bash
echo "PROJECT_DIR: $(pwd)"
echo "GIT_REMOTE: $(git remote get-url origin 2>/dev/null || echo 'none')"
echo "GIT_BRANCH: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "USER: $(whoami 2>/dev/null || echo 'unknown')"
echo "OS: $(uname -s 2>/dev/null || echo 'unknown') $(uname -m 2>/dev/null)"
```

수집한 정보를 JSON으로 구성한다:
```json
{
  "project_dir": "/Users/dante/workspace/project",
  "user_name": "dante",
  "agent": "claude-code",
  "model_id": "claude-opus-4-6",
  "git_remote": "git@github.com:user/repo.git",
  "git_branch": "main",
  "os": "Darwin arm64",
  "started_at": "2026-04-08T12:00:00Z"
}
```

- `agent`: 항상 "claude-code" (Claude Code 환경에서 실행 시)
- `model_id`: 현재 사용 중인 모델 ID (system prompt에서 확인 가능)
- `started_at`: 현재 UTC 시각
</HARD-RULE>


## Credential 사용 (API 서비스 노드)

advance 반환에 `credentials` 필드가 있으면 해당 노드는 외부 API 연동이 필요한 노드이다.

<HARD-RULE>
credentials.secrets의 키-값을 사용하여 API 호출을 수행한다.
예: credentials.secrets.ACCESS_TOKEN → curl -H "Authorization: Bearer $TOKEN" 형태로 사용
execute_step의 output에 시크릿 원본(토큰, 키 값)을 절대 포함하지 않는다.
결과(URL, 상태코드, 응답 요약)만 기록한다.
</HARD-RULE>
## 실행 절차

### 1. 워크플로 목록 조회 + 선택

`list_workflows`로 워크플로 목록을 가져온다.

**워크플로가 1개일 때** (#10): AskUserQuestion 대신 간단히 확인만 요청한다:
- "기능 브레인스토밍 워크플로를 시작합니다. 괜찮으신가요?" (AskUserQuestion으로 "시작/취소" 2개 옵션)

**워크플로가 2개 이상일 때**: AskUserQuestion으로 선택 UI를 표시한다.

### 2. 태스크 생성

`start_workflow`을 호출한다. 인자가 있으면 `context`로 전달한다.

### 3. 첫 번째 단계 즉시 실행 + auto_advance 루프

반환된 첫 번째 단계의 instruction을 **내부 지침으로 읽고 즉시 실행**한다.

실행 후 `execute_step`으로 결과를 저장하고, `advance`로 다음 단계를 확인한다.

**로드맵 표시** (#20): 시작 시 전체 단계 흐름을 간략히 보여준다:
```
기능 브레인스토밍 시작 (11단계)
━━━━━━━━━━━━━━━━━━━━━━━━━
**1**→2→3→4→5→6→7→8→9→10→11
━━━━━━━━━━━━━━━━━━━━━━━━━
```

**auto_advance 루프**: 다음 단계의 `auto_advance`가 `true`이면 멈추지 않고 계속 실행한다.

<HARD-RULE>
auto_advance=true인 단계를 실행한 후에는 반드시 다음 단계로 자동 진행한다.
중간 결과를 간략히 표시한다: "✅ [제목] 완료 → 다음 단계 진행 중..."
auto_advance=false인 단계를 만날 때까지 루프를 반복한다.
</HARD-RULE>

### 4. 멈출 때의 안내

- action 완료 후 (auto_advance=false): "다음 단계로 넘어가려면 `/bk-next`를 입력하세요."
- gate 질문 표시 후: 사용자 응답을 기다린다. `/bk-next`를 안내하지 않는다.
