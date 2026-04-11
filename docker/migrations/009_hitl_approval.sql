-- 009_hitl_approval.sql
-- HITL (Human-in-the-Loop) 승인 메커니즘
-- auto_advance = false 인 단계에서 에이전트가 advance를 호출하기 전에
-- 사람의 명시적 승인이 필요하도록 task_logs에 승인 관련 컬럼 추가

ALTER TABLE task_logs
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
