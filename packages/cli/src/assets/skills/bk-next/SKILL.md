---
name: bk-next
description: BlueKiwi 다음 단계 진행 스킬. 현재 단계를 마무리하고 다음 단계를 실행합니다. This skill should be used when the user says "/bk-next", "다음 단계", "다음", "계속", "진행해", or wants to proceed to the next step.
user_invocable: true
---

# BlueKiwi Next Step

현재 단계를 마무리하고, 다음 단계를 실행하는 스킬.

## 핵심 원칙

- **instruction은 에이전트의 내부 동작 지침이다. 사용자에게 그대로 노출하지 않는다.**
- 사용자에게는 실행 결과(분석, 질문, 제안)만 자연스럽게 보여준다.
- "노드", "node_type" 등 시스템 용어를 절대 사용하지 않는다.

## 자연어 진행 명령

사용자가 `/bk-next` 대신 "진행해", "다음", "계속", "넘어가자", "OK" 등 자연어로 진행 의사를 표현하면 동일하게 다음 단계로 진행한다.

## 세션 복원 (컨텍스트 주입)

advance 반환값에 `task_context`가 ���함된다. 이 데이터를 활용하여 새 세션에서도 이어 작업이 가능하다.

1. `task_context.running_context` — 누적된 결정사항과 프로젝트 상태. 반드시 읽고 이해한다.
2. `task_context.completed_steps` — 이전에 완료된 단계 요약. 어디까지 ��는지 파악한다.
3. `task_context.artifacts` — 참조 가능한 산출물 목록. `file_path`가 있으면 필요할 때 Read 도구로 읽는다.
4. `task_context.last_session` — 마지막 실행 세션 정보. 다른 세션/사용자가 진행한 경우 인지한다.

새 세션에서 이어가는 경우 (이전 대화 컨텍스트가 없�� 경우), task_context를 ���반으로 상황을 파악한 뒤 ��행한다.

## execute_step 호출 시 필수 파라미터

<HARD-RULE>
execute_step 호출 시 반드시 아래 파라미터를 채운다:
- `context_snapshot`: JSON 문자열. 이 단계에서 내린 결정사항, 주요 발견, 다음 단계 힌트를 구조화하여 저장한다.
  예: `{"decisions":[{"question":"기술 스택","chosen":"Next.js","reason":"팀 경험"}],"key_findings":["RLS 필요"],"next_step_hint":"구현 계획 작성"}`
- `session_id`: 현재 세션 ID (알 수 없으면 생략 가능)
- `agent_id`: 에이전트 식별자 (예: "claude-code")
- `model_id`: 사용 중인 LLM 모델 ID (예: "claude-opus-4-6", "gpt-5.2"). system prompt에서 확인.
- `user_name`: 사용자 이름 (알 수 없으면 생략 가능)

파일을 생성하거나 수정한 경우, `artifacts` 배열에 기록한다:

- 파일 생성: `{artifact_type: "file", title: "설계 문서", file_path: "docs/specs/design.md"}`
- 커밋한 경우: `{artifact_type: "git_commit", title: "Phase 1 구현", git_ref: "커밋해시"}`
- URL 생성: `{artifact_type: "url", title: "PR", url: "https://..."}`
  </HARD-RULE>

## Git 아티���트 저장

코드나 문서를 생성/수정한 단계를 완료한 후, 사용자에게 `save_artifacts`로 Git 브랜치에 저장할지 물어본다:

- "산출���을 Git 브랜치에 저장하시겠습니까?" (AskUserQuestion: "저장 (Recommended)" / "건너뛰기")
- 저장 시 `save_artifacts(task_id, message, file_paths)` 호출

## Credential 사용 (API 서비스 노드)

advance 반환에 `credentials` 필드가 있으면 해당 노드는 외부 API 연동이 필요한 노드이다.

<HARD-RULE>
credentials.secrets의 키-값을 사용하여 API 호출을 수행한다.
예: credentials.secrets.ACCESS_TOKEN → curl -H "Authorization: Bearer $TOKEN" 형태로 사용
execute_step의 output에 시크릿 원본(토큰, 키 값)을 절대 포함하지 않는다.
결과(URL, 상태코드, 응답 요약)만 기록한다.
</HARD-RULE>

## 실행 루프

```
LOOP:
  1. 현재 단계가 pending이면 → 대화에서 응답을 추출하여 execute_step으로 저장
  2. advance(peek=false)로 다음 단계를 가져온다
  3. 다음 단계가 finished이면 → complete_task 호출 후 종료
  4. 다음 단계를 실행한다 (아래 타입별 처리 참고)
  5. auto_advance를 확인한다:
     - true → 중간 결과 간략 표시 후 LOOP의 2번으로 돌아간다
     - false → 멈추고 결과를 표시한다
```

<HARD-RULE>
auto_advance=true인 단계를 실행한 후에는 반드시 다음 단계로 자동 진행한다.
"다음 단계로 넘어가려면 /bk-next"를 안내하지 않는다.
중간 결과를 간략히 한 줄로 표시한다: "✅ [제목] 완료 → 다음 단계 진행 중..."
auto_advance=false인 단계를 만날 때까지 이 루프를 반복한다.
</HARD-RULE>

## 타입별 처리

### action 단계

1. instruction을 읽고 수행한다. 태스크 context를 참고한다.
2. **heartbeat를 적극 사용한다**: 30초 이상 걸리는 작업에서는 반드시 heartbeat를 보낸다. 예: "아키텍처 섹션 분석 중...", "API 엔드포인트 설계 중...", "설계 문서 119행 작성 중..."
3. 수행 결과를 사용자에게 보여준다.
4. `execute_step`으로 저장한다.

### gate 단계

1. `get_web_response`로 웹 응답 먼저 확인.
2. 없으면 `AskUserQuestion`으로 자연스럽게 질문.
3. **부분 수정 옵션**: 승인/수정 질문에는 "승인 (Recommended)" / "부분 수정" / "전체 재작성" 3개 옵션.
4. 응답을 `execute_step`으로 저장.

### loop 단계

1. instruction 수행.
2. **종료 전 사용자 확인**: 종료 조건 충족 시 자동 종료하지 않고 AskUserQuestion으로 확인한다:
   - "수집된 정보가 충분합니다. 추가로 확인할 사항이 있으신가요?"
   - "충분합니다 (Recommended)" / "추가 질문이 있습니다"
3. **loop 반복마다 개별 execute_step을 호출한다.** 여러 질문의 답변을 하나로 합치지 않는다. 각 반복이 별도 로그로 기록되어야 한다.
4. `loop_continue` true/false로 execute_step.

## 로드맵 표시

매 단계 시작 시 진행 상황을 한 줄로 표시한다:

```
✅1 → ✅2 → ✅3 → **4** → 5 → 6 → 7 → 8 → 9 → 10 → 11
```

## 멈출 때의 안내 (auto_advance=false일 때만)

- action 완료 후: "다음 단계로 넘어가려면 `/bk-next`를 입력하세요."
- gate 질문 후: 사용자 응답을 기다린다.

## 완료 메시지

<HARD-RULE>
워크플로 완료 시 `complete_task`를 호출할 때 `summary` 파라미터에 반드시 내용을 채운다. 빈 문자열로 보내지 않는다.
summary에는 마크다운으로 결정 사항, 산출물 경로, 다음 단계 제안을 포함한다.
</HARD-RULE>

```
complete_task(task_id=N, status="completed", summary="## 결정 사항\n- 목적: ...\n- 접근 방식: ...\n\n## 산출물\n- 설계 문서: `docs/specs/...`\n- 구현 계획: `docs/specs/...`\n\n## 다음 단계\nPhase 1부터 구현을 시작하세요.")
```

사용자에게 완료 메시지 표시:

```
🎉 브레인스토밍 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━

## 결정 사항 요약
[핵심 결정 사항 테이블]

## 산출물
- 📄 설계 문서: `docs/specs/YYYY-MM-DD-xxx-design.md`
- 📋 구현 계획: `docs/specs/YYYY-MM-DD-xxx-implementation-plan.md`

## 다음 단계
구현을 시작하려면 Phase 1부터 진행하세요.
━━━━━━━━━━━━━━━━━━━━━━━━━
```

## output 기록 형식

<HARD-RULE>
모든 output은 최소 200자 이상이어야 한다. 한 줄 요약만 보내지 않는다.
반드시 ## 헤딩 구조를 사용한다.
어투는 "~했습니다"체로 통일한다.
생성된 파일이 있으면 절대경로를 포함한다.
</HARD-RULE>

action:

```markdown
## 수행 내용

프로젝트 컨텍스트를 분석했습니다.

## 결과

- **프로젝트명**: recipe-sharing-app
- **현재 상태**: 초기 단계 (코드 없음)
- **기술 스택**: 미정
- **주요 발견**: ...

## 산출물

설계 문서를 `/tmp/or-test-verify/docs/specs/2026-04-08-recipe-design.md`에 저장했습니다.
```

gate:

```markdown
## 질문

이 프로젝트 관리 도구가 해결하려는 핵심 문제는 무엇인가요?

## 선택지

1. 개인 태스크 관리 (추천)
2. 팀 협업
3. 교육용

## 응답

"개인 태스크 관리"를 선택했습니다 — 개인 생산성 향상을 위한 태스크 추적 도구로 진행합니다.
```

## 코멘트 확인

코멘트가 있으면 실행 전에 사용자에게 알리고 처리 방법을 AskUserQuestion으로 물어본다.

## 실패 처리

AskUserQuestion으로: 건너뛰기 / 재시도 / 이전 단계 / 중단.
