-- Migration 001: Version System + Workflow Contract + Structured Output
-- Sprint 1: 2026-04-09

-- ─── A. 워크플로 버전 시스템 ───

ALTER TABLE chains ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE chains ADD COLUMN IF NOT EXISTS parent_chain_id INTEGER REFERENCES chains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chains_parent ON chains(parent_chain_id);
CREATE INDEX IF NOT EXISTS idx_chains_version ON chains(version);

-- ─── B. 워크플로 Contract (평가 기준) ───

ALTER TABLE chains ADD COLUMN IF NOT EXISTS evaluation_contract JSONB DEFAULT NULL;

-- evaluation_contract 구조 예시:
-- {
--   "steps": {
--     "1": { "min_output_length": 500, "required_sections": ["배경", "목적"], "require_context_snapshot": true },
--     "3": { "min_output_length": 1000, "min_source_urls": 3 }
--   },
--   "global": {
--     "min_avg_output_length": 800,
--     "require_all_context_snapshots": true
--   },
--   "qualitative": {
--     "analysis_depth": "high",
--     "consistency_check": true
--   },
--   "auto_improve": {
--     "safe_fixes": true,
--     "structural_changes_require_approval": true
--   }
-- }

CREATE TABLE IF NOT EXISTS workflow_evaluations (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  score_quantitative REAL,
  score_qualitative REAL,
  score_total REAL,
  details JSONB NOT NULL DEFAULT '{}',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_evals_task ON workflow_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_chain ON workflow_evaluations(chain_id);

-- ─── C. Output 구조화 ───

ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS structured_output JSONB DEFAULT NULL;

-- structured_output 구조:
-- {
--   "user_input": "사용자가 입력한 원본 텍스트 (gate 노드에서)",
--   "thinking": "에이전트의 사고 과정",
--   "assistant_output": "최종 출력 (마크다운)"
-- }
