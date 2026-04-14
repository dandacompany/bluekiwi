---
name: bk-help
description: BlueKiwi help skill. Shows a formatted list of all available bk-* commands with descriptions and usage. Use when the user says "/bk-help", "bk help", "what bk commands are there", or asks about BlueKiwi commands.
user_invocable: true
---

# BlueKiwi Help

Output the following help text **exactly as formatted** (use markdown code-free output — render it as readable text, not a code block).

---

## BlueKiwi 명령어 도움말

### 실행

| 명령어                           | 설명                                                |
| -------------------------------- | --------------------------------------------------- |
| `/bk-start`                      | 워크플로 선택 후 즉시 실행. 미완료 태스크 복구 포함 |
| `/bk-start <이름>`               | 이름으로 워크플로 매칭 후 바로 실행                 |
| `/bk-start <ID>`                 | 워크플로 ID로 바로 실행 (숫자)                      |
| `/bk-start #<태스크ID>`          | 특정 태스크 직접 재개                               |
| `/bk-start <이름> :: <프롬프트>` | 워크플로 지정 + 초기 컨텍스트 전달                  |
| `/bk-next`                       | 실행 중인 태스크를 찾아 현재 스텝부터 재개          |
| `/bk-approve`                    | 대기 중인 HITL 승인 처리                            |
| `/bk-rewind`                     | 이전 스텝으로 되돌리기                              |

### 설계 / 관리

| 명령어            | 설명                                       |
| ----------------- | ------------------------------------------ |
| `/bk-design`      | 자연어 목표로 새 워크플로 설계 및 등록     |
| `/bk-improve`     | 기존 워크플로 분석 후 개선 버전 생성       |
| `/bk-version`     | 버전 목록 조회, 활성화/비활성화, 버전 비교 |
| `/bk-instruction` | 에이전트 인스트럭션 템플릿 생성·수정·삭제  |
| `/bk-credential`  | 외부 서비스 API 키 등록·수정·삭제          |

### 조회 / 공유

| 명령어       | 설명                               |
| ------------ | ---------------------------------- |
| `/bk-status` | 실행 중·완료된 태스크 현황 조회    |
| `/bk-report` | 태스크 결과 구조화 리포트 생성     |
| `/bk-share`  | 워크플로·폴더를 그룹에 공유        |
| `/bk-scan`   | 로컬 저장소 보안·컴플라이언스 스캔 |

---

**팁:**

- `/bk-start`는 `/bk-run`의 상위 호환입니다 — 두 명령어 모두 동작합니다.
- 태스크 재개가 필요하면 `/bk-start` (인자 없음) 또는 `/bk-start #<태스크ID>`를 사용하세요.
- 도움말은 언제든 `/bk-help`로 다시 볼 수 있습니다.
