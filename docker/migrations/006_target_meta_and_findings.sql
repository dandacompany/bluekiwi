-- Migration 004: Add tasks.target_meta + compliance findings schema
-- Feature A: Standardized review target context (target_meta)
-- Feature B: Compliance finding schema (schema only; no logic)

-- Feature A — Review target context standardization
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS target_meta JSONB DEFAULT NULL;

-- Feature B — Taggable compliance metadata on logs/comments
ALTER TABLE task_logs
  ADD COLUMN IF NOT EXISTS rule_id TEXT;
ALTER TABLE task_logs
  ADD COLUMN IF NOT EXISTS severity TEXT;

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS rule_id TEXT;
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS severity TEXT;

-- Feature B — Structured compliance findings table
CREATE TABLE IF NOT EXISTS compliance_findings (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('BLOCK','REVIEW','WARN','INFO')),
  summary TEXT NOT NULL,
  detail TEXT,
  fix TEXT,
  authority TEXT,
  file_path TEXT,
  line_number INTEGER,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_task ON compliance_findings(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_rule ON compliance_findings(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_step ON compliance_findings(task_id, step_order);
