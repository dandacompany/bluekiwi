# OmegaRod Workflow Evaluation Framework

워크플로 실행 결과의 품질을 정량적/정성적으로 평가하고, 반복 실행 간 개선을 추적하는 프레임워크.

## 평가 차원 (7개)

### 정량 지표 (자동 계산 가능)

| ID  | 지표                        | 측정 방법                         | 기준                        |
| --- | --------------------------- | --------------------------------- | --------------------------- |
| Q1  | **Output 충실도**           | 각 스텝 output의 글자 수          | 최소 400자, gate 최소 300자 |
| Q2  | **Context Snapshot 존재율** | context_snapshot이 있는 스텝 비율 | 100%                        |
| Q3  | **출처 URL 수**             | 검색 스텝의 sources URL 총 개수   | 최소 15개 (전체)            |
| Q4  | **실행 완주율**             | 완료된 스텝 / 전체 스텝           | 100%                        |
| Q5  | **총 실행 시간**            | 첫 스텝 시작 ~ 마지막 스텝 완료   | 10분 이내 (6스텝 기준)      |

### 정성 지표 (LLM-as-judge)

| ID  | 지표          | 평가 기준                    | 점수 |
| --- | ------------- | ---------------------------- | ---- |
| S1  | **분석 깊이** | 표면적 나열 vs 인사이트 도출 | 1-10 |
| S2  | **일관성**    | 스텝 간 맥락 연결, 모순 없음 | 1-10 |

## 점수 계산

```
정량 점수 = (Q1통과율 + Q2 + Q3통과 + Q4 + Q5통과) / 5 × 100
정성 점수 = (S1 + S2) / 2 × 10
종합 점수 = 정량 × 0.6 + 정성 × 0.4
```

## 평가 API

### 자동 평가 (정량)

```sql
-- Q1: Output 충실도
SELECT step_order, node_title, LENGTH(output) as chars,
  CASE WHEN LENGTH(output) >= 400 THEN 'PASS' ELSE 'FAIL' END as q1
FROM task_logs WHERE task_id = $1 AND status = 'completed';

-- Q2: Context Snapshot 존재율
SELECT COUNT(*) FILTER (WHERE context_snapshot IS NOT NULL) * 100.0 / COUNT(*) as q2
FROM task_logs WHERE task_id = $1 AND status = 'completed';

-- Q3: 출처 URL 수 (context_snapshot에서 sources 배열 크기 합산)
-- 파싱 필요

-- Q4: 완주율
SELECT COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as q4
FROM task_logs WHERE task_id = $1;

-- Q5: 총 실행 시간
SELECT EXTRACT(EPOCH FROM (MAX(completed_at) - MIN(started_at))) / 60 as minutes
FROM task_logs WHERE task_id = $1 AND status = 'completed';
```

### LLM-as-judge (정성)

서브에이전트에게 task_logs.output 전체를 전달하고 S1/S2 점수를 요청:

```
다음은 "시장 조사" 워크플로의 실행 결과입니다.
각 스텝의 output을 읽고 아래 기준으로 1-10 점수를 매겨주세요.

S1 (분석 깊이): 단순 검색 결과 나열이면 1-3, 인사이트 도출이면 4-6, 전략적 제안이면 7-10
S2 (일관성): 스텝 간 맥락 단절이면 1-3, 부분적 연결이면 4-6, 완전한 스토리라인이면 7-10

JSON으로 응답: {"s1": N, "s2": N, "s1_reason": "...", "s2_reason": "..."}
```

## 기록 테이블

```sql
CREATE TABLE IF NOT EXISTS workflow_evaluations (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  chain_id INTEGER NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  q1_output_chars JSONB,      -- {"step1": 401, "step2": 523, ...}
  q1_pass_rate REAL,
  q2_context_rate REAL,
  q3_source_count INTEGER,
  q4_completion_rate REAL,
  q5_total_minutes REAL,
  s1_depth INTEGER,
  s1_reason TEXT,
  s2_consistency INTEGER,
  s2_reason TEXT,
  quant_score REAL,
  qual_score REAL,
  total_score REAL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 개선 추적

같은 워크플로의 v1, v2, v3... 평가 점수를 비교:

```sql
SELECT version, total_score, quant_score, qual_score, evaluated_at
FROM workflow_evaluations
WHERE chain_id = $1
ORDER BY evaluated_at ASC;
```

## 사용 시나리오

1. 워크플로 실행 완료
2. `/or-eval {task_id}` 스킬 호출 (미래)
3. 정량 평가 자동 실행 → DB 저장
4. 정성 평가를 서브에이전트에게 위임 → DB 저장
5. 이전 버전과 비교 → 개선 여부 판정
6. 개선 포인트를 instruction 또는 코드에 반영
7. 다시 실행 → 평가 루프
