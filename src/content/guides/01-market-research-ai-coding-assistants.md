# BlueKiwi 실전 튜토리얼 #01 — 시장조사 워크플로

## 0. 이 튜토리얼이 보여주는 것

자연어 한 줄을 던지면 BlueKiwi가:

1. `/bk-design` 으로 7단계 워크플로를 **설계 → DB 등록**
2. `/bk-start` 로 **단계별 자동 실행** (웹 검색 + 산출물 작성)
3. 중간에 **VS Gate(Visual Selection)** 로 사람 검토 받고
4. 최종 **마크다운 보고서** 까지 자동 생성

까지 끝낸다는 것을, 실제로 돌린 세션 로그와 함께 보여줍니다.

---

## 1. 사전 준비

### 1-1. BlueKiwi CLI 설치 & 서버 연결

```bash
npm i -g bluekiwi
bluekiwi accept <초대 토큰>      # 또는 bluekiwi login
bluekiwi --version                # 0.3.9
```

`~/.bluekiwi/config.json` 에 서버 URL과 API 키가 저장됩니다.

```json
{
  "server_url": "https://dantelabs.bluekiwi.work",
  "api_key": "bk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### 1-2. Claude Code MCP 등록 확인

설치 시 `~/.claude.json` 의 `mcpServers.bluekiwi` 가 자동 등록됩니다.

```json
{
  "command": "node",
  "args": ["/Users/.../node_modules/bluekiwi/dist/assets/mcp/server.js"],
  "env": {
    "BLUEKIWI_API_URL": "https://dantelabs.bluekiwi.work",
    "BLUEKIWI_API_KEY": "bk_..."
  }
}
```

### 1-3. ⚠️ 권한 모드 주의

`don't ask` 모드로 Claude Code를 띄우면 **MCP 툴 호출이 자동 차단**됩니다 (이번 세션에서 한 번 막혔던 부분). 다음 중 하나로 시작하세요:

```bash
# 권장: bypass 모드 (개인 머신에서)
claude --permission-mode bypassPermissions

# 또는 acceptEdits — MCP는 매번 승인 묻기
claude --permission-mode acceptEdits
```

세션 시작 후 우하단에 `⏵⏵ bypass permissions on` 이 보이면 OK.

![screenshot: Claude Code 시작 화면 — 우하단 'bypass permissions on' 표시](../images/01-claude-bypass-mode.png)

---

## 2. 한 줄 프롬프트

작업 폴더(`~/workspace/.../test`)에서 Claude Code를 띄우고 다음을 입력:

```text
BlueKiwi MCP를 이용해서 국내 AI 코딩 어시스턴트 시장(Cursor, Windsurf,
Claude Code 중심) 시장조사를 진행해줘.

비교 항목:
- 가격 정책 (개인/팀/엔터프라이즈)
- 핵심 기능 차별점
- 한국 사용자 커뮤니티 반응 (블로그, 유튜브, 커뮤니티)
- 강점과 약점

워크플로로 설계(/bk-design)하고 실행(/bk-start)까지 진행해서, 마지막에
마크다운 비교 보고서까지 만들어줘.
```

이게 끝입니다. 이후는 모두 에이전트가 알아서 합니다.

![screenshot: 프롬프트 입력 직후 에이전트가 /bk-design 스킬을 로드하는 모습](../images/02-prompt-submitted.png)

---

## 3. Step-by-Step 진행 로그

### Phase A — `/bk-design` 워크플로 설계

```
⏺ Skill(bk-design)  Successfully loaded skill
  Called bluekiwi 2 times, searched memories
```

에이전트가 BlueKiwi에서 기존 폴더/워크플로를 살펴보고, 메모리에서
"시장조사" 패턴을 검색한 뒤 **7단계 설계안**을 제시합니다.

```
Workflow: 국내 AI 코딩 어시스턴트 시장조사 (Cursor/Windsurf/Claude Code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [조사 범위·항목 정의]            action
2. [Cursor 리서치]                  action
3. [Windsurf 리서치]                action
4. [Claude Code 리서치]             action
5. [비교 분석 & 강약점 도출]        action
6. [초안 검토]                      gate (VS: pros-cons)
7. [최종 마크다운 보고서 생성]      action
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total 7 steps · Folder: Marketing & Content
```

![screenshot: bk-design이 제안한 7단계 워크플로 트리](../images/03-bk-design-workflow-tree.png)

> **★ 설계 인사이트 (에이전트가 직접 남긴 메모)**
>
> - 제품별로 리서치 노드를 분리하면 각 단계의 아티팩트가 독립적으로
>   저장되어 최종 비교 단계에서 `load_artifacts` 로 병합하기 쉽다.
> - 6번 gate에 `pros-cons` VS 컴포넌트를 쓰면 단순 승인이 아니라
>   "보완 필요 항목"을 시각적으로 선택받을 수 있어 반복 없이 품질이 올라감.

이후 `create_workflow` + `append_node` × 7회로 서버에 등록:

```
✅ Workflow registered
Name: 국내 AI 코딩 어시스턴트 시장조사 (ID: 90) · Steps: 7 · Version: 1.0
```

![screenshot: dantelabs.bluekiwi.work/workflows/90 — 등록된 워크플로 상세 페이지](../images/04-workflow-registered-web.png)

### Phase B — `/bk-start` 실행

```
⏺ Skill(bk-start)  Successfully loaded skill

Starting: 국내 AI 코딩 어시스턴트 시장조사 (7 steps)
━━━━━━━━━━━━━━━━━━━━━━━━━
**1** → 2 → 3 → 4 → 5 → 6 → 7
━━━━━━━━━━━━━━━━━━━━━━━━━
```

각 단계가 BlueKiwi 서버 측에서 추적되며(태스크 #1), 진행 상황을 웹 UI에서
실시간으로 볼 수 있습니다.

![screenshot: 태스크 진행 상황을 보여주는 웹 UI — 7단계 진행 바 + 실시간 로그](../images/05-task-live-progress.png)

#### Step 1 — 조사 범위·항목 정의

`scope.json` (42줄) 작성. targets / pricing tiers / 한국 검색 쿼리까지
구조화.

```json
{
  "targets": ["Cursor", "Windsurf", "Claude Code"],
  "comparison_fields": {
    "pricing": { "tiers": ["개인", "팀", "엔터프라이즈"], ... },
    "core_features": { ... },
    "korean_community": { ... },
    "strengths_weaknesses": { ... }
  }
}
```

#### Step 2-4 — 제품별 리서치 (Cursor / Windsurf / Claude Code)

각 제품마다 **4건씩 웹 검색** 후 JSON 산출물 작성:

```
⏺ Step 2: Cursor 리서치
⏺ Web Search("Cursor AI editor pricing 2026 Hobby Pro Business Enterprise plan")
⏺ Web Search("Cursor AI 후기 사용법 한국 블로그 2025")
⏺ Web Search("Cursor Composer Agent Tab MCP features codebase indexing 2026")
⏺ Web Search("커서 AI 단점 불만 한국 개발자 유튜브")
⏺ Write(cursor.json)  → 61줄
```

영문 + 한글 쿼리를 섞어서 글로벌 가격 정보 + 국내 사용자 반응을
모두 수집한 점이 핵심.

![screenshot: 터미널에서 Web Search 4회 → Write(cursor.json) 출력 흐름](../images/06-step2-cursor-research.png)

#### Step 5 — 비교 분석 & 강약점 도출

`comparison.md` (72줄) 작성. 가격 비교표 + 기능 차별점 + 한국 커뮤니티
반응 + SWOT 형태의 강약점 정리.

#### Step 6 — 초안 검토 (VS Gate) ⏸

여기서 에이전트가 **사람의 결정**을 기다립니다:

```
☐ 초안 결정
초안을 확인하셨나요? 바로 최종 보고서를 생성할까요, 아니면 보완 항목을
추가할까요?

❯ 1. 승인 (최종 보고서 생성)
  2. 보안·프라이버시 추가 후 생성
  3. 벤치마크 추가 후 생성
  4. 한국 기업 도입 사례 추가
  5. Type something.
```

![screenshot: VS Gate — 4가지 보완 옵션이 표시된 AskUserQuestion 다이얼로그](../images/07-vs-gate-options.png)

이번에는 `1. 승인`을 선택. (실무에선 2~4를 골라 보완 루프를 한 번 더
돌릴 수도 있음.)

> 💡 **VS Gate**는 BlueKiwi의 핵심 차별점 중 하나입니다. 단순히
> "y/n" 묻는 대신, 워크플로 설계 시 정의해둔 선택지를 시각적으로 보여주고
> 사용자가 고르게 합니다.

#### Step 7 — 최종 마크다운 보고서 생성

`ai-coding-assistants-kr-report.md` (15KB, 7 섹션) 자동 작성:

1. Executive Summary
2. 가격 정책 비교
3. 핵심 기능 차별점
4. 한국 커뮤니티 반응
5. 강점/약점
6. 사용자 유형별 추천
7. 출처 & 한계

![screenshot: 완료 메시지 — '✅ Task #1 Completed — 7/7 steps' 및 산출물 표](../images/08-task-completed.png)

---

## 4. 최종 산출물

작업 폴더에 다음 파일들이 남습니다:

| 파일                                | 크기      | 역할                                  |
| ----------------------------------- | --------- | ------------------------------------- |
| `scope.json`                        | 2 KB      | 조사 범위·비교 항목·한국 검색 쿼리    |
| `cursor.json`                       | 4 KB      | Cursor 원시 리서치 데이터 (출처 포함) |
| `windsurf.json`                     | 4 KB      | Windsurf 원시 리서치 데이터           |
| `claude-code.json`                  | 5 KB      | Claude Code 원시 리서치 데이터        |
| `comparison.md`                     | 9 KB      | 비교 분석 초안 (중간 산출물)          |
| `ai-coding-assistants-kr-report.md` | **15 KB** | **최종 보고서 (7 섹션)**              |

서버 측에는 워크플로 #90, 태스크 #1 로 모든 단계 로그·아티팩트가 보존되어
**같은 워크플로를 다른 주제로 재실행** 할 수 있습니다.

![screenshot: 작업 폴더 트리 — scope.json부터 최종 보고서까지 6개 파일](../images/09-output-files.png)
![screenshot: ai-coding-assistants-kr-report.md 렌더링 — 비교표가 보이는 섹션 1~2](../images/10-final-report-preview.png)

---

## 5. 핵심 결론 (보고서 요약)

에이전트가 보고서 끝에 남긴 한 줄 요약:

- **Cursor** — Tab 속도·즉시성 최강, 단 한국 정책 홀대·가격 부담
- **Windsurf** — Cascade 대용량 컨텍스트·한글 친화, 단 소유권 변동 리스크
- **Claude Code** — 서브에이전트·Skills·Hooks 조립식 확장성 + 한국어 공식 생태계
  가장 두꺼움, 단 터미널 진입장벽

---

## 6. 회고 — 무엇이 좋았고, 무엇을 조심해야 하나

### 잘 동작한 것

- **자연어 한 줄 → 7단계 자동 실행**: 사용자가 단계를 하나씩 지시할 필요가
  없음. `/bk-design` 이 설계까지 알아서 해줌.
- **중간 산출물 분리**: `cursor.json` / `windsurf.json` / `claude-code.json`
  로 나뉘어 있어, 한 제품만 갱신해서 재실행하기 쉬움.
- **VS Gate**: "그냥 자동으로 다 하지 말고 내가 한번 보고 결정"이 한 단계로
  깔끔하게 들어감.

### 막혔던 부분 (남이 따라할 때 주의)

- **권한 모드**: `don't ask` 로 띄우면 MCP 호출이 통째로 차단됨.
  반드시 `bypassPermissions` 또는 `acceptEdits` 로 시작.
- **VS Gate 폴링 URL이 localhost로 표시**: bk-start 스킬이 출력하는
  `http://localhost:3100/tasks/N` 은 dev 환경 기본값. 실제 호스팅 서버를
  쓸 때는 `https://dantelabs.bluekiwi.work/tasks/N` 으로 직접 접속하면 됨.
  (에이전트는 폴링 + AskUserQuestion 폴백을 같이 쓰므로 터미널에서도 응답 가능.)

### 응용 아이디어

이번 워크플로 #90 은 **"3개 대상 × 4개 비교 축 × VS 검토"** 라는 일반
시장조사 패턴이라 그대로 **다른 주제로 재사용** 가능합니다:

- 노코드 자동화 툴 비교 (n8n / Make / Zapier / Activepieces)
- 벡터 DB 비교 (Pinecone / Weaviate / Qdrant / pgvector)
- LLM 게이트웨이 비교 (OpenRouter / LiteLLM / Portkey)

`/bk-start workflow_id=90` 하면서 입력 프롬프트만 바꾸면 같은 구조로
다시 돌아갑니다.
