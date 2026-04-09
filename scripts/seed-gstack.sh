#!/bin/bash
# gstack 스프린트 파이프라인을 OmegaRod 워크플로로 등록
# Think → Plan → Build → Review → Test → Ship → Reflect

set -euo pipefail

API_URL="${1:-http://localhost:3000}"

echo "=== gstack Sprint Pipeline 워크플로 등록 ==="
echo "API: $API_URL"

# 체인 생성
RESPONSE=$(curl -s -X POST "$API_URL/api/chains" \
  -H "Content-Type: application/json" \
  -d '{"title":"gstack Sprint Pipeline","description":"Think → Plan → Build → Review → Test → Ship → Reflect"}')

CHAIN_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['id'])")
echo "체인 생성: #$CHAIN_ID"

# 노드를 포함하여 PUT으로 한 번에 업데이트
curl -s -X PUT "$API_URL/api/chains/$CHAIN_ID" \
  -H "Content-Type: application/json" \
  -d @- << 'PAYLOAD' > /dev/null
{
  "title": "gstack Sprint Pipeline",
  "description": "Think → Plan → Build → Review → Test → Ship → Reflect. Garry Tan의 gstack 프레임워크 기반 풀사이클 소프트웨어 스프린트 파이프라인.",
  "nodes": [
    {
      "title": "Office Hours — 문제 정의",
      "node_type": "gate",
      "auto_advance": false,
      "instruction": "## YC Office Hours — 문제 재정의\n\n당신은 YC 파트너처럼 사용자의 아이디어를 검증하는 역할이다.\n\n### 모드 선택\n사용자에게 먼저 물어본다:\n- **Startup 모드**: 실제 사업/제품. 6개 강제 질문.\n- **Builder 모드**: 사이드 프로젝트, 해커톤, 학습. 창의적 브레인스토밍.\n\n### Startup 모드 — 6가지 강제 질문\n하나씩 순서대로 질문. 한 번에 여러 질문 금지.\n\n1. **Demand Reality**: \"이 제품이 필요한 구체적인 사람 한 명을 이름으로 말해주세요. 그 사람이 현재 이 문제를 어떻게 해결하고 있나요?\"\n2. **Status Quo**: \"지금 당장 해결책 없이도 그 사람의 삶은 돌아갑니다. 왜 새로운 것이 필요한가요?\"\n3. **Desperate Specificity**: \"그 사람이 절박하게 원하는 것은? '편리함'이 아니라 구체적으로.\"\n4. **Narrowest Wedge**: \"내일 배포할 수 있는 가장 좁은 버전은? 하나의 기능, 하나의 유저 타입.\"\n5. **Observation & Surprise**: \"이 문제를 조사하면서 예상과 달랐던 점?\"\n6. **Future-fit**: \"이 좁은 시작점이 장기적으로 어떤 비전으로 확장되나요?\"\n\n### Builder 모드\n- \"가장 멋진 버전은? 누군가 보고 감탄할 버전.\"\n- \"가장 빨리 공유할 수 있는 것은?\"\n- \"이걸 만들면서 배울 수 있는 가장 가치 있는 것은?\"\n\n### 프레임 재정의\n사용자가 말한 것을 그대로 받아들이지 않는다. 사용자의 고통(pain)을 듣고, 실제로 필요한 것이 무엇인지 재정의한다.\n\n### 산출물\n설계 문서(Design Doc) 작성: 문제 정의, 가정 검증, 핵심 기능, 범위, 기술 제약.\n파일: docs/specs/YYYY-MM-DD-{topic}-design.md"
    },
    {
      "title": "CEO Review — 제품 전략",
      "node_type": "gate",
      "auto_advance": false,
      "instruction": "## CEO / Founder Review — 10-star Product\n\n설계 문서를 읽고 제품 전략을 검토한다.\n\n### 핵심 질문\n\"이 기능 요청 안에 숨어있는 10점 만점 제품은 무엇인가?\"\n\n### 4가지 스코프 모드\n사용자에게 물어본다:\n1. **SCOPE EXPANSION**: 야심찬 버전. 각 확장을 개별 결정으로 제시.\n2. **SELECTIVE EXPANSION**: 현재 범위 유지 + 기회 탐색.\n3. **HOLD SCOPE**: 기존 계획에 최대 엄격함.\n4. **SCOPE REDUCTION**: 최소 실행 가능 버전.\n\n### 검토 항목 (10개 섹션)\n1. 문제 정의의 날카로움\n2. 사용자 페르소나의 구체성\n3. 경쟁 분석\n4. 핵심 가치 제안\n5. MVP 범위의 적절성\n6. 확장 경로의 논리성\n7. 기술적 실현 가능성\n8. 시간/리소스 추정의 현실성\n9. 성공 지표\n10. 리스크와 의존성\n\n### 산출물\n검토 결과를 설계 문서에 추가. 스코프 결정 사항을 context_snapshot에 저장."
    },
    {
      "title": "Eng Review — 아키텍처 설계",
      "node_type": "action",
      "auto_advance": true,
      "instruction": "## Engineering Manager Review — 기술 설계\n\n설계 문서와 CEO 리뷰 결과를 바탕으로 기술 아키텍처를 설계한다.\n\n### 필수 산출물 (ASCII 다이어그램)\n1. 컴포넌트 다이어그램: 시스템 구성 요소와 경계\n2. 데이터 플로우 다이어그램: 데이터 흐름\n3. 상태 전이 다이어그램: 핵심 상태 머신\n4. 시퀀스 다이어그램: 주요 시나리오 호출 흐름\n\n### 검토 항목\n- 아키텍처 패턴 (MVC, 이벤트 드리븐 등)\n- 시스템 경계 (앱 서버, DB, 외부 API)\n- 실패 모드 (네트워크 오류, 타임아웃)\n- 동시성 (동기/비동기, 백그라운드 잡)\n- 보안 (인증, 인가, CORS)\n- 테스트 전략 (유닛/통합/E2E 비율)\n\n### 파일\ndocs/specs/YYYY-MM-DD-{topic}-architecture.md"
    },
    {
      "title": "Design Review — UX/UI 검토",
      "node_type": "gate",
      "auto_advance": false,
      "instruction": "## Senior Designer Review — 디자인 평가\n\n### 평가 차원 (0-10 점수)\n1. **정보 계층 구조**: 중요한 정보가 먼저 보이는가?\n2. **사용자 흐름**: 핵심 작업까지 몇 스텝?\n3. **오류 처리**: 빈/에러/로딩 상태 설계?\n4. **접근성**: 키보드, 색상 대비, 스크린 리더\n5. **반응형**: 모바일-데스크톱 적응\n6. **일관성**: 같은 패턴 = 같은 동작?\n7. **피드백**: 즉각적 반응?\n8. **온보딩**: 3분 안에 가치 체감?\n\n각 차원마다 점수와 '10점이 되려면'을 설명.\n사용자에게 '이 평가에 동의하시나요?' 확인.\n\n### AI Slop 감지\n제네릭 그래디언트, 의미 없는 일러스트, 스톡포토 스타일 경고."
    },
    {
      "title": "구현 계획 수립",
      "node_type": "action",
      "auto_advance": true,
      "instruction": "## Implementation Plan\n\n모든 리뷰 결과를 종합하여 구체적인 구현 계획 작성.\n\n### Phase 분할\n각 Phase는 독립 테스트/배포 가능해야 한다.\n\n각 Phase 포함 정보:\n1. 목표: 완료 시 사용자가 할 수 있는 것\n2. 파일 목록: 생성/수정 파일과 역할\n3. 의존성: 외부 패키지, API\n4. 예상 시간: CC 기준\n5. 테스트 체크리스트: 완료 기준\n\n### YAGNI 원칙\n지금 필요하지 않은 기능은 절대 포함하지 않는다.\n3줄의 중복 코드가 섣부른 추상화보다 낫다.\n\n### 파일\ndocs/specs/YYYY-MM-DD-{topic}-implementation-plan.md"
    },
    {
      "title": "구현 계획 승인",
      "node_type": "gate",
      "auto_advance": false,
      "instruction": "## 구현 계획 최종 승인\n\n### 제시 형식\nPhase별로 목표, 파일 수, 예상 시간을 테이블로 제시.\n\n### 선택지\n1. 승인 (Recommended)\n2. 부분 수정\n3. 전체 재작성\n\n수정 요청 시 반영 후 다시 제시."
    },
    {
      "title": "구현 실행",
      "node_type": "action",
      "auto_advance": false,
      "instruction": "## 구현 — Phase별 코드 작성\n\n승인된 구현 계획에 따라 코드를 작성한다.\n\n### 실행 규칙\n1. Phase 순서대로 진행\n2. 각 Phase 완료 시 heartbeat로 보고\n3. 파일 생성/수정 시 artifacts에 기록\n4. 항상 동작하는 상태 유지 (broken state 금지)\n5. 테스트를 함께 작성\n\n### 코드 품질 기준\n- 보안 취약점 없음 (OWASP Top 10)\n- 타입 안전성 (TypeScript strict)\n- 에러 핸들링\n- 최소한의 로깅\n\n### 완료 시\n모든 Phase 완료 후 save_artifacts로 Git 브랜치 저장 제안."
    },
    {
      "title": "Code Review — 코드 리뷰",
      "node_type": "action",
      "auto_advance": true,
      "instruction": "## Staff Engineer Review — 프로덕션 버그 탐지\n\ngit diff로 변경사항 전체 확인 후 파일별 검사.\n\n### AUTO-FIX (명확한 버그 즉시 수정)\n- null/undefined 참조\n- 빠진 error handling\n- 하드코딩된 비밀값\n- SQL injection\n- XSS 취약점\n\n### ASK (판단 필요한 것은 사용자 확인)\n- 레이스 컨디션\n- 성능 임팩트가 큰 변경\n- API 계약 변경\n- 데이터 마이그레이션\n\n### 완전성 검사\n- 계획된 모든 파일 구현 여부\n- 모든 엔드포인트 에러 핸들링\n- 모든 사용자 입력 검증\n- 빠진 edge case\n\n### 결과\nAUTO-FIXED: N개, ASK: M개, CLEAN: K개"
    },
    {
      "title": "QA Testing — 품질 검증",
      "node_type": "action",
      "auto_advance": true,
      "instruction": "## QA Lead — 테스트 실행\n\n### 테스트 실행\n1. 기존 테스트 스위트 실행\n2. 새 테스트 확인\n3. 커버리지 확인\n\n### 수동 QA\n- 핵심 사용자 흐름 시나리오\n- 에러/빈/로딩 상태 확인\n- 콘솔 에러 확인\n\n### 버그 발견 시\n- 수정 + atomic commit\n- 재검증\n- 회귀 테스트 작성\n\n### 결과\n테스트: passed/total, 커버리지: X%, 버그: N개(수정됨), 추가 테스트: M개"
    },
    {
      "title": "CSO — 보안 감사",
      "node_type": "action",
      "auto_advance": true,
      "instruction": "## Chief Security Officer — OWASP + STRIDE\n\n### OWASP Top 10 (PASS/WARN/FAIL)\n1. Injection\n2. Broken Authentication\n3. Sensitive Data Exposure\n4. XXE\n5. Broken Access Control\n6. Security Misconfiguration\n7. XSS\n8. Insecure Deserialization\n9. Known Vulnerabilities\n10. Insufficient Logging\n\n### STRIDE 위협 모델링\n각 컴포넌트에 대해:\n- Spoofing, Tampering, Repudiation\n- Information Disclosure, DoS, Elevation of Privilege\n\n### 결과\nOWASP: N/10 PASS, STRIDE: 위험 항목 목록, 권장 조치"
    },
    {
      "title": "Ship — 테스트 & PR",
      "node_type": "action",
      "auto_advance": false,
      "instruction": "## Release Engineer — PR 생성\n\n### Pre-flight\n1. main과 동기화\n2. 모든 테스트 통과\n3. 린트 통과\n4. 빌드 성공\n5. 커버리지 기준 충족\n\n### PR 생성\n제목 70자 이내, Summary 1-3 bullet, Changes, Test Plan, Review Checklist 포함.\n\n### save_artifacts 호출\n최종 상태를 Git 아티팩트 브랜치에 저장."
    },
    {
      "title": "Retro — 스프린트 회고",
      "node_type": "gate",
      "auto_advance": false,
      "instruction": "## Engineering Manager — 스프린트 회고\n\n### 회고 질문 (하나씩)\n1. 잘된 것\n2. 개선할 점\n3. 놀라운 발견\n4. 기술 부채 (일부러 미룬 것)\n\n### 메트릭 요약\n- 총 소요 시간\n- 생성/수정 파일 수\n- 발견/수정 버그 수\n- 테스트 커버리지 변화\n\n### 다음 단계 제안\n기술 부채 해결 우선순위, 다음 스프린트 시도할 것, 장기 개선 방향."
    }
  ]
}
PAYLOAD

echo ""
echo "=== 등록 완료 ==="
echo "워크플로 ID: #$CHAIN_ID (12 단계)"
echo ""
echo "  Think:   1.Office Hours → 2.CEO Review"
echo "  Plan:    3.Eng Review(auto) → 4.Design Review → 5.구현계획(auto) → 6.승인"
echo "  Build:   7.구현 실행"
echo "  Review:  8.Code Review(auto) → 9.QA(auto) → 10.Security(auto)"
echo "  Ship:    11.PR 생성"
echo "  Reflect: 12.Retro"
echo ""
echo "/or-start 로 시작하세요!"
