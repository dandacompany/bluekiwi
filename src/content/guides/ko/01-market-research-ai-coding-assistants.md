# BlueKiwi 실전 튜토리얼 #01 — 시장조사 워크플로

## 0. 이 튜토리얼이 보여주는 것

자연어 한 줄을 던지면 BlueKiwi가:

1. `/bk-design` 스킬로 7단계 워크플로를 **설계 → 서버 등록**
2. `/bk-start` 스킬로 **단계별 자동 실행** (웹 검색 + 산출물 작성)
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

### 1-2. 스킬 등록 확인

BlueKiwi CLI를 설치하면 `/bk-design`, `/bk-start` 등의 **스킬**이 Claude Code에 자동 등록됩니다. 스킬은 Claude Code의 슬래시 커맨드로 실행되며, 내부적으로 BlueKiwi 서버와 통신합니다.

> **사용자는 스킬만 호출하면 됩니다.** MCP 연결이나 API 호출은 스킬이 알아서 처리합니다.

설치가 정상적으로 완료되면 Claude Code 세션에서 `/bk-` 로 시작하는 스킬들을 바로 사용할 수 있습니다.

### 1-3. ⚠️ 권한 모드 주의

스킬이 BlueKiwi 서버와 자동으로 통신하려면 **적절한 권한 모드**로 Claude Code를 시작해야 합니다. `don't ask` 모드에서는 스킬 실행이 차단되어 매 단계마다 수동 승인이 필요합니다.

```bash
# 권장: bypass 모드 — 스킬이 자동으로 실행됨 (개인 머신에서 사용)
claude --permission-mode bypassPermissions

# 또는 acceptEdits — 스킬 실행 시 승인 팝업이 뜸
claude --permission-mode acceptEdits
```

세션 시작 후 우하단에 `⏵⏵ bypass permissions on` 이 보이면 OK.

---

## 2. 한 줄 프롬프트

작업 폴더(`~/workspace/.../test`)에서 Claude Code를 띄우고 다음을 입력:

```text
국내 AI 코딩 어시스턴트 시장(Cursor, Windsurf, Claude Code 중심)
시장조사를 진행해줘.

비교 항목:
- 가격 정책 (개인/팀/엔터프라이즈)
- 핵심 기능 차별점
- 한국 사용자 커뮤니티 반응 (블로그, 유튜브, 커뮤니티)
- 강점과 약점

/bk-design 으로 워크플로를 설계하고 /bk-start 로 실행까지 진행해서,
마지막에 마크다운 비교 보고서까지 만들어줘.
```

이게 끝입니다. 이후는 모두 에이전트가 알아서 합니다.

---

## 3. Step-by-Step 진행 로그

### Phase A — `/bk-design` 워크플로 설계

```
⏺ Skill(bk-design)  Successfully loaded skill
```

에이전트가 `/bk-design` 스킬을 실행합니다. 스킬은 BlueKiwi 서버에서 기존 폴더·워크플로를 조회하고, 목표에 맞는 **7단계 설계안**을 제시합니다.

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

설계안을 승인하면 스킬이 워크플로를 BlueKiwi 서버에 등록합니다:

```
✅ Workflow registered
Name: 국내 AI 코딩 어시스턴트 시장조사 (ID: 90) · Steps: 7 · Version: 1.0
```

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

---

## 5. 핵심 결론 (보고서 요약)

에이전트가 보고서 끝에 남긴 한 줄 요약:

- **Cursor** — Tab 속도·즉시성 최강, 단 한국 정책 홀대·가격 부담
- **Windsurf** — Cascade 대용량 컨텍스트·한글 친화, 단 소유권 변동 리스크
- **Claude Code** — 서브에이전트·Skills·Hooks 조립식 확장성 + 한국어 공식 생태계
  가장 두꺼움, 단 터미널 진입장벽

---

## 6. 정리 및 활용 팁

### 이 워크플로의 강점

- **자연어 한 줄로 7단계 자동 실행**: 각 단계를 직접 지시할 필요 없이 `/bk-design` 스킬이 목표를 분석해 전체 구조를 설계합니다.
- **단계별 산출물 분리**: `cursor.json` / `windsurf.json` / `claude-code.json` 처럼 각 단계의 결과가 독립적으로 저장되므로 특정 항목만 수정해 재실행할 수 있습니다.
- **VS Gate로 중간 개입**: "일단 끝까지 자동 실행"이 아니라, 중간 검토 시점을 워크플로 안에 명시적으로 포함시킬 수 있습니다.

### 주의 사항

- **권한 모드 설정 필수**: `don't ask` 모드에서는 스킬 자동 실행이 차단됩니다. 반드시 `bypassPermissions` 또는 `acceptEdits` 모드로 시작하세요.

### 응용 아이디어

이 워크플로는 **"N개 대상 × 비교 축 × VS 검토"** 구조로 설계되어 있어 다른 주제에 그대로 재사용할 수 있습니다:

- 노코드 자동화 툴 비교 (n8n / Make / Zapier / Activepieces)
- 벡터 DB 비교 (Pinecone / Weaviate / Qdrant / pgvector)
- LLM 게이트웨이 비교 (OpenRouter / LiteLLM / Portkey)

`/bk-start workflow_id=90` 실행 시 입력 프롬프트만 바꾸면 동일한 구조로 다시 실행됩니다.

[이 워크플로 내 워크스페이스에 추가하기](bk://try/01-market-research-ai-coding-assistants)
