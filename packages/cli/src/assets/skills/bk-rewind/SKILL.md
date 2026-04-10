---
name: bk-rewind
description: BlueKiwi 특정 스텝으로 되돌아가기 스킬. 진행 중인 태스크의 이전 단계 또는 특정 단계로 되돌아갑니다. This skill should be used when the user says "/bk-rewind", "이전 단계", "다시 돌아가", "rewind", or wants to go back to a previous step in the BlueKiwi chain.
user_invocable: true
---

# BlueKiwi Rewind

진행 중인 태스크의 특정 스텝으로 되돌아가는 스킬. 이전 실행 기록은 보존되며, 해당 스텝에 새 pending 로그가 생성된다.

## 인자 처리

- `/bk-rewind` → 인자 없음. `AskUserQuestion`으로 되돌아갈 스텝을 선택하도록 한다.
- `/bk-rewind 3` → 스텝 번호 직접 지정.
- `/bk-rewind 명확화 질문` → 스텝 제목으로 매칭.

## MCP 도구

- `mcp__bluekiwi__advance` (peek: true) — 현재 태스크/스텝 상태 확인
- `mcp__bluekiwi__rewind` — 특정 스텝으로 되돌아가기
- `mcp__bluekiwi__get_comments` — 코멘트 조회

## 실행 절차

### 1. 현재 태스크 확인

`advance`를 `peek: true`로 호출하여 활성 태스크를 확인한다.
- 활성 태스크가 없으면 → "활성 태스크가 없습니다." 안내 후 종료.

### 2. 되돌아갈 스텝 결정

인자가 없으면 `AskUserQuestion`으로 선택 UI를 표시한다:
- 완료된 스텝 목록을 옵션으로 제공
- 각 옵션의 description에 해당 스텝의 output 요약 포함
- preview에 해당 스텝에 달린 코멘트 표시

인자가 숫자이면 해당 스텝 번호를 사용한다.
인자가 텍스트이면 스텝 제목과 매칭하여 스텝 번호를 결정한다.

### 3. 사용자 요구사항 확인

되돌아가기 전에 `AskUserQuestion`으로 물어본다:
```
"Step [N]([제목])으로 되돌아갑니다. 이 단계를 다시 실행할 때 특별히 반영할 요구사항이 있으신가요?"
```

옵션:
- "그대로 다시 진행 (Recommended)" — 추가 컨텍스트 없이 진행
- "요구사항 있음" — Other로 자유 입력

사용자가 요구사항을 입력하면 해당 내용을 코멘트로 서버에 저장한다 (task_comments).

### 4. Rewind 실행

`mcp__bluekiwi__rewind`를 호출하여 해당 스텝으로 되돌아간다.

결과 표시:
```
━━━━━━━━━━━━━━━━━━━━━━━━━
Step [N]/[Total]로 되돌아갑니다: [노드 제목] [[node_type]]
(이전 실행 기록은 보존됩니다)
━━━━━━━━━━━━━━━━━━━━━━━━━
[instruction 내용]
━━━━━━━━━━━━━━━━━━━━━━━━━
→ /bk-next 로 이 노드를 다시 실행하세요.
```

## 중요 규칙

- 되돌아가기 전에 항상 사용자에게 추가 요구사항이 있는지 확인할 것.
- 요구사항이 있으면 코멘트로 서버에 저장하여 `/bk-next` 실행 시 참고되도록 할 것.
- `AskUserQuestion`으로 모든 선택을 처리할 것.
