# BlueKiwi 실전 튜토리얼 #02 — bk-import: 외부 자료를 워크플로로 변환

## 0. 이 튜토리얼이 보여주는 것

GitHub 레포, 로컬 스킬, 외부 URL — 어떤 자료든 `/bk-import` 한 줄이면:

1. repomix / WebFetch로 **자료를 깊이 있게 분석**
2. 프로세스 로직을 **action / gate / loop 노드로 번역**
3. 상세하고 실행 가능한 **지침이 담긴 워크플로를 서버에 등록**
4. 브라우저에서 바로 확인하고 `/bk-run`으로 실행

까지 끝납니다.

---

## 1. 지원 입력 타입

| 타입                   | 예시                            | 분석 방법                               |
| ---------------------- | ------------------------------- | --------------------------------------- |
| GitHub 레포 URL        | `https://github.com/owner/repo` | repomix `--remote` (Tree-sitter 압축)   |
| GitHub 단축 표기       | `owner/repo`                    | 동일                                    |
| 로컬 스킬 이름         | `bk-design`, `bk-start`         | `~/.claude/skills/<name>/SKILL.md` 읽기 |
| 로컬 경로              | `~/projects/my-script`          | 파일 직접 읽기                          |
| 외부 URL               | `https://example.com/guide`     | WebFetch                                |
| 텍스트 / JSON 붙여넣기 | n8n 워크플로 JSON 등            | 직접 파싱                               |

---

## 2. 빠른 시작

### 2-1. GitHub 레포에서 워크플로 만들기

```text
/bk-import yamadashy/repomix
```

에이전트가 자동으로:

1. `npx repomix@latest --remote yamadashy/repomix --compress` 실행
2. README + 주요 파일에서 프로세스 로직 추출
3. 순차 단계 → action, 분기 → gate, 반복 → loop 노드로 번역
4. 제안된 구조를 보여주고 확인 요청

### 2-2. 로컬 스킬에서 워크플로 만들기

```text
/bk-import bk-design
```

`~/.claude/skills/bk-design/SKILL.md`를 읽어 해당 스킬의 실행 흐름을 BlueKiwi 워크플로로 변환합니다.

### 2-3. 외부 문서에서 워크플로 만들기

```text
/bk-import https://docs.example.com/runbook/deploy
```

WebFetch로 페이지를 가져와 기술된 절차를 워크플로로 변환합니다.

---

## 3. 인터랙션 흐름

```
사용자: /bk-import yamadashy/repomix

에이전트:
  📦 레포 패킹 중... (repomix --compress)
  ✓ 파일 43개, 토큰 ~18,000개

  📦 Importing: yamadashy/repomix

  Proposed workflow: Repomix — 레포 분석 파이프라인
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [레포 목적 & 구조 파악]    action
  2. [분석 범위 선택]            gate  ← 사용자 결정
  3. [패턴 심층 탐색]            loop ↩ 반복
  4. [분석 결과 검토]            gate  ← 사용자 승인
  5. [인사이트 보고서 생성]      action
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  5 steps · source: yamadashy/repomix

  [Create] [Edit node structure] [Cancel]
```

---

## 4. 노드 지침 품질

`/bk-import`는 `/bk-design`과 동일한 **Instruction Depth Standard**를 적용합니다. 각 노드 지침에는 반드시:

1. **역할/컨텍스트** — 이 단계를 수행하는 주체
2. **번호 매긴 하위 단계** — 무엇을 어떻게 할지
3. **산출물 명세** — 파일 경로, 포맷, 구조
4. **검증 방법** — 완료 기준
5. **loop 노드** — 명시적 종료 조건

이 기준을 충족하지 못하는 1–2문장짜리 지침은 자동으로 거부하고 상세화합니다.

---

## 5. 실전 예시 — n8n 워크플로 JSON 변환

n8n에서 내보낸 워크플로 JSON을 Claude Code에 붙여넣고:

```text
/bk-import
```

입력 타입을 선택하는 질문에서 "Paste text or JSON"을 고르고 JSON을 입력하면, n8n의 노드 구조(Trigger → HTTP Request → If → Set → ...)를 BlueKiwi action/gate/loop로 매핑합니다.

---

## 6. 가져온 워크플로 실행

등록이 완료되면 바로 실행할 수 있습니다:

```text
/bk-run
```

또는 브라우저에서 열린 워크플로 페이지의 **Run** 버튼을 클릭합니다.

[bk://try/02-repomix-analysis-pipeline]

---

## 7. 팁

- **GitHub 레포가 크다면** repomix가 자동으로 `--compress`를 적용해 토큰을 ~70% 절감합니다.
- **결과가 마음에 안 든다면** "Edit node structure"를 선택해 특정 노드만 수정할 수 있습니다.
- **이미 비슷한 워크플로가 있다면** `/bk-improve`로 기존 것을 개선하는 것이 더 효율적입니다.
- **로컬 스킬 이름**은 `/bk-` 접두사 없이도 인식합니다 (`design` → `bk-design`으로 자동 해석).
