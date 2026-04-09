#!/bin/bash
# OmegaRod v2 시드 — brainstorming 완전 매핑 체인
BASE="http://localhost:3000/api"
H="Content-Type: application/json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OmegaRod v2 시드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# 재사용 지침 블록
echo ""
echo "📦 재사용 지침 블록..."

I1=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "프로젝트 컨텍스트 탐색",
  "content": "현재 프로젝트의 디렉토리 구조, package.json, README, 최근 git 커밋 10개를 분석한다.\n\n확인할 것:\n- 사용 중인 프레임워크와 라이브러리\n- 프로젝트 구조 패턴\n- 기존 코딩 컨벤션\n- 최근 작업 방향\n\n결과를 간결하게 요약한다.",
  "agent_type": "general",
  "tags": ["분석", "컨텍스트"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I1: 프로젝트 컨텍스트 탐색"

I2=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "접근 방식 제안",
  "content": "주어진 목표에 대해 2-3가지 접근 방식을 제안한다.\n\n각 방식마다:\n- 핵심 아이디어 (1-2문장)\n- 장점\n- 단점/리스크\n- 예상 복잡도 (낮음/중간/높음)\n\n마지막에 추천 방식과 그 이유를 명시한다. 추천 방식을 첫 번째로 배치한다.",
  "agent_type": "general",
  "tags": ["설계", "의사결정"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I2: 접근 방식 제안"

I3=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "설계 문서 작성",
  "content": "합의된 접근 방식을 바탕으로 설계 문서를 작성한다.\n\n포함할 섹션:\n1. 개요 — 무엇을, 왜 만드는가\n2. 아키텍처 — 주요 컴포넌트와 데이터 흐름\n3. API/인터페이스 — 외부에 노출되는 인터페이스\n4. 에러 처리 — 실패 시나리오와 대응\n5. 테스트 전략 — 무엇을 어떻게 검증할 것인가\n\n각 섹션은 복잡도에 비례하여 간결하게 작성한다.\ndocs/specs/ 디렉토리에 YYYY-MM-DD-{topic}-design.md로 저장한다.",
  "agent_type": "general",
  "tags": ["문서화", "설계"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I3: 설계 문서 작성"

I4=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "스펙 자체 검토",
  "content": "작성된 설계 문서를 새로운 눈으로 검토한다.\n\n1. Placeholder 스캔: TBD, TODO, 미완성 섹션, 모호한 요구사항이 있는지 확인\n2. 내부 일관성: 섹션 간 모순이 없는지, 아키텍처가 기능 설명과 일치하는지 확인\n3. 범위 체크: 단일 구현 계획으로 충분한 범위인지, 분해가 필요한지 확인\n4. 모호성 체크: 두 가지로 해석될 수 있는 요구사항이 있으면 하나를 선택하고 명시\n\n발견된 문제를 인라인으로 수정한다.",
  "agent_type": "general",
  "tags": ["검토", "품질"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I4: 스펙 자체 검토"

I5=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "구현 계획 작성",
  "content": "설계 문서를 바탕으로 단계별 구현 계획을 작성한다.\n\n각 단계마다:\n- 작업 내용 (구체적으로)\n- 관련 파일\n- 의존성 (이전 단계 필요 여부)\n- 예상 검증 방법\n\n순서는 의존성을 고려하여 가장 독립적인 것부터 배치한다.",
  "agent_type": "general",
  "tags": ["계획", "구현"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I5: 구현 계획 작성"

# Chain #1: 기능 브레인스토밍 (brainstorming 완전 매핑, 11 steps)
echo ""
echo "🔗 체인 생성..."

curl -s -X POST "$BASE/chains" -H "$H" -d "{
  \"title\": \"기능 브레인스토밍\",
  \"description\": \"brainstorming 스킬의 전체 흐름을 체인으로 구현. 컨텍스트 탐색 → 비주얼 컴패니언 → 명확화 질문 → 접근 방식 → 설계 → 검토 → 구현 전환\",
  \"nodes\": [
    {
      \"title\": \"프로젝트 컨텍스트 탐색\",
      \"node_type\": \"action\",
      \"auto_advance\": true,
      \"instruction_id\": $I1
    },
    {
      \"title\": \"비주얼 컴패니언 제안\",
      \"node_type\": \"gate\",
      \"auto_advance\": false,
      \"instruction\": \"이후 질문 중 시각적 자료(목업, 다이어그램, 레이아웃 비교)가 필요한 내용이 있을 수 있다.\\n\\n사용자에게 물어본다:\\n'시각적 자료가 필요한 질문이 있을 수 있습니다. 웹 브라우저에서 목업이나 다이어그램을 볼까요?'\\n\\n이 질문만 단독으로 전달한다. 다른 질문과 합치지 않는다.\"
    },
    {
      \"title\": \"범위 확인\",
      \"node_type\": \"gate\",
      \"auto_advance\": false,
      \"instruction\": \"요청이 여러 독립적인 서브시스템을 포함하는지 평가한다.\\n\\n단일 프로젝트 범위이면 그대로 진행한다.\\n분해가 필요하면 서브 프로젝트로 나누고, 첫 번째 서브 프로젝트부터 진행할 것을 제안한다.\\n\\n사용자에게 범위가 적절한지 확인을 요청한다.\"
    },
    {
      \"title\": \"명확화 질문\",
      \"node_type\": \"loop\",
      \"auto_advance\": false,
      \"instruction\": \"한 번에 하나의 질문만 한다. 가능하면 객관식으로 제시한다.\\n\\n파악해야 할 것:\\n- 목적: 이 기능이 해결하는 문제는?\\n- 제약조건: 기술 스택, 성능, 보안 제한사항?\\n- 성공 기준: 완성의 기준은?\\n\\n종료 조건: 목적, 범위, 제약조건, 성공 기준이 모두 명확해졌을 때 종료한다.\",
      \"loop_back_to\": 4
    },
    {
      \"title\": \"접근 방식 제안\",
      \"node_type\": \"action\",
      \"auto_advance\": true,
      \"instruction_id\": $I2
    },
    {
      \"title\": \"접근 방식 선택\",
      \"node_type\": \"gate\",
      \"auto_advance\": false,
      \"instruction\": \"제안한 접근 방식들을 사용자에게 보여주고 선택을 요청한다.\\n\\n추천 방식을 첫 번째로 제시하고 이유를 설명한다.\\n수정을 원하면 반영한다.\"
    },
    {
      \"title\": \"설계 섹션 발표\",
      \"node_type\": \"loop\",
      \"auto_advance\": false,
      \"instruction\": \"설계를 섹션별로 나누어 발표한다.\\n\\n각 섹션은 복잡도에 비례: 단순하면 몇 문장, 복잡하면 200-300 단어.\\n\\n다룰 영역: 아키텍처, 컴포넌트, 데이터 흐름, 에러 처리, 테스트.\\n\\n각 섹션 발표 후 사용자에게 괜찮은지 확인한다.\\n모든 섹션이 승인되면 종료한다.\\n\\n종료 조건: 모든 설계 섹션이 사용자에게 승인되었을 때.\",
      \"loop_back_to\": 7
    },
    {
      \"title\": \"설계 문서 작성\",
      \"node_type\": \"action\",
      \"auto_advance\": true,
      \"instruction_id\": $I3
    },
    {
      \"title\": \"스펙 자체 검토\",
      \"node_type\": \"action\",
      \"auto_advance\": true,
      \"instruction_id\": $I4
    },
    {
      \"title\": \"사용자 스펙 검토\",
      \"node_type\": \"gate\",
      \"auto_advance\": false,
      \"instruction\": \"작성된 스펙 문서의 경로를 안내하고 사용자에게 검토를 요청한다.\\n\\n'스펙이 작성되어 [경로]에 저장되었습니다. 검토 후 수정할 부분이 있으면 말씀해주세요. 괜찮다면 구현 계획으로 넘어가겠습니다.'\\n\\n수정 요청 시 반영 후 다시 검토를 요청한다.\"
    },
    {
      \"title\": \"구현 계획 작성\",
      \"node_type\": \"action\",
      \"auto_advance\": false,
      \"instruction_id\": $I5
    }
  ]
}" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  ✅ Chain #{d[\"id\"]}: {d[\"title\"]} ({len(d[\"nodes\"])} steps)')
types = {'action': 'A', 'gate': 'G', 'loop': 'L'}
for n in d['nodes']:
    t = types.get(n['node_type'], '?')
    ref = f' -> inst #{n[\"instruction_id\"]}' if n.get('instruction_id') else ''
    loop = f' [loop->step {n[\"loop_back_to\"]}]' if n.get('loop_back_to') else ''
    print(f'     {n[\"step_order\"]:2d}. [{t}] {n[\"title\"]}{ref}{loop}')
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ v2 시드 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
