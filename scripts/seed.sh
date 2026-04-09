#!/bin/bash
# OmegaRod 더미 데이터 시드 스크립트
# Usage: bash scripts/seed.sh

BASE="http://localhost:3000/api"
H="Content-Type: application/json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OmegaRod 더미 데이터 시드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 재사용 가능한 지침 블록 ───
echo ""
echo "📦 재사용 지침 블록 생성..."

I1=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "프로젝트 컨텍스트 분석",
  "content": "현재 프로젝트의 디렉토리 구조, package.json, README, 최근 git 커밋 10개를 분석하세요.\n\n확인할 것:\n- 사용 중인 프레임워크와 라이브러리\n- 프로젝트 구조 패턴 (모노레포, 레이어드 등)\n- 기존 코딩 컨벤션\n- 최근 작업 방향\n\n결과를 간결하게 요약하세요.",
  "agent_type": "general",
  "tags": ["분석", "컨텍스트"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I1: 프로젝트 컨텍스트 분석"

I2=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "접근 방식 제안",
  "content": "주어진 목표에 대해 2-3가지 접근 방식을 제안하세요.\n\n각 방식마다:\n- 핵심 아이디어 (1-2문장)\n- 장점\n- 단점/리스크\n- 예상 복잡도 (낮음/중간/높음)\n\n마지막에 추천 방식과 그 이유를 명시하세요.",
  "agent_type": "general",
  "tags": ["설계", "의사결정"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I2: 접근 방식 제안"

I3=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "설계 문서 작성",
  "content": "합의된 접근 방식을 바탕으로 설계 문서를 작성하세요.\n\n포함할 섹션:\n1. 개요 — 무엇을, 왜 만드는가\n2. 아키텍처 — 주요 컴포넌트와 데이터 흐름\n3. API/인터페이스 — 외부에 노출되는 인터페이스\n4. 에러 처리 — 실패 시나리오와 대응\n5. 테스트 전략 — 무엇을 어떻게 검증할 것인가\n\n각 섹션은 복잡도에 비례하여 간결하게 작성합니다.\ndocs/specs/ 디렉토리에 YYYY-MM-DD-{topic}-design.md로 저장하세요.",
  "agent_type": "general",
  "tags": ["문서화", "설계"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I3: 설계 문서 작성"

I4=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "보안 코드 리뷰",
  "content": "변경된 코드에 대해 보안 관점으로 리뷰합니다.\n\nOWASP Top 10 기준:\n- Injection (SQL, Command, XSS)\n- Broken Authentication\n- Sensitive Data Exposure\n- Security Misconfiguration\n\n발견된 이슈를 severity(critical/high/medium/low)로 분류하여 보고하세요.\n취약점이 없으면 \"보안 이슈 없음\"을 명시하세요.",
  "agent_type": "coding",
  "tags": ["보안", "리뷰"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I4: 보안 코드 리뷰"

I5=$(curl -s -X POST "$BASE/instructions" -H "$H" -d '{
  "title": "구현 계획 작성",
  "content": "설계 문서를 바탕으로 단계별 구현 계획을 작성하세요.\n\n각 단계마다:\n- 작업 내용 (구체적으로)\n- 관련 파일\n- 의존성 (이전 단계 필요 여부)\n- 예상 검증 방법\n\n순서는 의존성을 고려하여 가장 독립적인 것부터 배치합니다.",
  "agent_type": "general",
  "tags": ["계획", "구현"]
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✅ #$I5: 구현 계획 작성"

# ─── 체인 1: 기능 브레인스토밍 (brainstorming 스킬 모델) ───
echo ""
echo "🔗 체인 생성..."

curl -s -X POST "$BASE/chains" -H "$H" -d "{
  \"title\": \"기능 브레인스토밍\",
  \"description\": \"새 기능 아이디어를 탐색하고 설계 문서로 정리하는 워크플로 (brainstorming 스킬 모델)\",
  \"nodes\": [
    {
      \"title\": \"프로젝트 컨텍스트 파악\",
      \"node_type\": \"action\",
      \"instruction_id\": $I1
    },
    {
      \"title\": \"기능 목표 확인\",
      \"node_type\": \"gate\",
      \"instruction\": \"사용자에게 다음을 질문하세요:\\n\\n1. 어떤 기능을 만들고 싶으신가요?\\n2. 이 기능의 주요 목적은 무엇인가요?\\n3. 특별한 제약조건이 있나요? (기술 스택, 성능, 보안 등)\\n4. 성공 기준은 무엇인가요?\\n\\n한 번에 하나씩 질문하고, 각 답변을 기록하세요.\"
    },
    {
      \"title\": \"추가 질문\",
      \"node_type\": \"loop\",
      \"instruction\": \"사용자의 답변을 분석하고, 설계에 필요한 추가 정보가 있다면 질문하세요.\\n\\n종료 조건: 기능의 목적, 범위, 제약조건, 성공 기준이 모두 명확해졌을 때 종료합니다.\\n더 이상 질문이 필요 없다면 '충분한 정보를 수집했습니다'라고 보고하세요.\",
      \"loop_back_to\": 3
    },
    {
      \"title\": \"접근 방식 제안\",
      \"node_type\": \"action\",
      \"instruction_id\": $I2
    },
    {
      \"title\": \"접근 방식 선택\",
      \"node_type\": \"gate\",
      \"instruction\": \"제안한 접근 방식들을 사용자에게 보여주고 선택을 요청하세요.\\n\\n'어떤 접근 방식이 좋으시겠습니까? 수정하고 싶은 부분이 있으면 말씀해주세요.'\"
    },
    {
      \"title\": \"설계 문서 작성\",
      \"node_type\": \"action\",
      \"instruction_id\": $I3
    },
    {
      \"title\": \"설계 검토\",
      \"node_type\": \"gate\",
      \"instruction\": \"작성된 설계 문서를 사용자에게 보여주세요.\\n\\n'설계 문서를 검토해주세요. 수정할 부분이 있으면 말씀해주세요. 괜찮다면 구현 계획으로 넘어가겠습니다.'\"
    },
    {
      \"title\": \"구현 계획 작성\",
      \"node_type\": \"action\",
      \"instruction_id\": $I5
    }
  ]
}" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  ✅ Chain #{d[\"id\"]}: {d[\"title\"]} ({len(d[\"nodes\"])} steps)')
types = {'action': '⚡', 'gate': '🚪', 'loop': '🔄'}
for n in d['nodes']:
    t = types.get(n['node_type'], '?')
    ref = f' → instruction #{n[\"instruction_id\"]}' if n.get('instruction_id') else ''
    loop = f' ↩ step {n[\"loop_back_to\"]}' if n.get('loop_back_to') else ''
    print(f'     {n[\"step_order\"]}. {t} [{n[\"node_type\"]}] {n[\"title\"]}{ref}{loop}')
"

# ─── 체인 2: PR 보안 리뷰 ───
curl -s -X POST "$BASE/chains" -H "$H" -d "{
  \"title\": \"PR 보안 리뷰\",
  \"description\": \"Pull Request의 변경사항을 보안 관점으로 검토하는 워크플로\",
  \"nodes\": [
    {
      \"title\": \"PR diff 수집\",
      \"node_type\": \"action\",
      \"instruction\": \"현재 브랜치의 변경된 파일 목록과 diff를 수집하세요.\\ngit diff main...HEAD 또는 해당하는 base 브랜치와 비교합니다.\"
    },
    {
      \"title\": \"보안 검토\",
      \"node_type\": \"action\",
      \"instruction_id\": $I4
    },
    {
      \"title\": \"리뷰 결과 확인\",
      \"node_type\": \"gate\",
      \"instruction\": \"보안 리뷰 결과를 사용자에게 보여주세요.\\n\\n이슈가 있다면: '다음 보안 이슈가 발견되었습니다. 수정하시겠습니까?'\\n이슈가 없다면: '보안 이슈가 발견되지 않았습니다. 리뷰 코멘트를 작성할까요?'\"
    },
    {
      \"title\": \"리뷰 코멘트 작성\",
      \"node_type\": \"action\",
      \"instruction\": \"보안 리뷰 결과를 바탕으로 PR 리뷰 코멘트를 작성하세요.\\n\\n포맷:\\n- 파일명:라인번호 — [severity] 이슈 설명\\n- 권장 수정 방안\\n\\n이슈가 없으면 'LGTM — 보안 이슈 없음' 코멘트를 작성하세요.\"
    }
  ]
}" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  ✅ Chain #{d[\"id\"]}: {d[\"title\"]} ({len(d[\"nodes\"])} steps)')
types = {'action': '⚡', 'gate': '🚪', 'loop': '🔄'}
for n in d['nodes']:
    t = types.get(n['node_type'], '?')
    ref = f' → instruction #{n[\"instruction_id\"]}' if n.get('instruction_id') else ''
    print(f'     {n[\"step_order\"]}. {t} [{n[\"node_type\"]}] {n[\"title\"]}{ref}')
"

# ─── 체인 3: 데이터 분석 파이프라인 ───
curl -s -X POST "$BASE/chains" -H "$H" -d '{
  "title": "데이터 분석 파이프라인",
  "description": "데이터를 수집, 정제, 분석, 시각화하는 단계별 워크플로",
  "nodes": [
    {
      "title": "데이터 소스 확인",
      "node_type": "gate",
      "instruction": "사용자에게 분석할 데이터 소스를 물어보세요.\n\n- 파일 경로 (CSV, JSON, Excel)\n- API 엔드포인트\n- 데이터베이스 쿼리\n\n데이터 형식과 대략적인 크기도 확인하세요."
    },
    {
      "title": "데이터 로드 및 탐색",
      "node_type": "action",
      "instruction": "지정된 소스에서 데이터를 로드하고 기본 탐색을 수행하세요.\n\n확인할 것:\n- 행/열 수, 컬럼 타입\n- 결측치 비율\n- 기초 통계 (mean, median, std)\n- 상위 5행 미리보기\n\nJupyter 노트북이나 스크립트로 작성하세요."
    },
    {
      "title": "분석 목표 설정",
      "node_type": "gate",
      "instruction": "데이터 탐색 결과를 보여주고, 사용자에게 구체적인 분석 목표를 물어보세요.\n\n예시:\n- 특정 패턴/추세 발견\n- 그룹 간 비교\n- 예측 모델 구축\n- 이상치 탐지"
    },
    {
      "title": "데이터 정제 및 분석",
      "node_type": "action",
      "instruction": "분석 목표에 맞게 데이터를 정제하고 분석을 수행하세요.\n\n- 결측치 처리 (제거 또는 대체)\n- 이상치 처리\n- 필요한 변환 (인코딩, 스케일링 등)\n- 분석 목표에 맞는 통계/ML 분석 수행"
    },
    {
      "title": "결과 시각화",
      "node_type": "action",
      "instruction": "분석 결과를 시각화하세요.\n\nmatplotlib, seaborn, plotly 중 적합한 라이브러리를 사용합니다.\n- 핵심 인사이트를 보여주는 차트 2-3개\n- 각 차트에 제목, 축 레이블, 범례 포함\n- 차트 아래에 인사이트 요약 추가"
    },
    {
      "title": "보고서 검토",
      "node_type": "gate",
      "instruction": "분석 결과와 시각화를 사용자에게 보여주세요.\n\n추가 분석이 필요한지, 결과를 어떤 형태로 저장할지 물어보세요.\n(노트북 그대로 / PDF 보고서 / 대시보드 등)"
    }
  ]
}' | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  ✅ Chain #{d[\"id\"]}: {d[\"title\"]} ({len(d[\"nodes\"])} steps)')
types = {'action': '⚡', 'gate': '🚪', 'loop': '🔄'}
for n in d['nodes']:
    t = types.get(n['node_type'], '?')
    print(f'     {n[\"step_order\"]}. {t} [{n[\"node_type\"]}] {n[\"title\"]}')
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 시드 완료!"
echo "  - 재사용 지침: 5개"
echo "  - 체인: 3개"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
