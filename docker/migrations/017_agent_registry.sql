-- 017_agent_registry.sql

-- 1. agent_registry 테이블 생성
CREATE TABLE IF NOT EXISTS agent_registry (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('provider', 'model')),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, slug)
);

-- 2. 빌트인 seed
INSERT INTO agent_registry (kind, slug, display_name, is_builtin) VALUES
  ('provider', 'claude-code', 'Claude Code', true),
  ('provider', 'codex-cli', 'Codex CLI', true),
  ('provider', 'gemini-cli', 'Gemini CLI', true),
  ('provider', 'cursor', 'Cursor', true),
  ('provider', 'windsurf', 'Windsurf', true),
  ('provider', 'antigravity', 'Antigravity', true),
  ('provider', 'opencode', 'OpenCode', true),
  ('model', 'claude-opus-4-6', 'Claude Opus 4.6', true),
  ('model', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', true),
  ('model', 'claude-haiku-4-5', 'Claude Haiku 4.5', true),
  ('model', 'gpt-5.2', 'GPT-5.2', true),
  ('model', 'gemini-2.5-pro', 'Gemini 2.5 Pro', true)
ON CONFLICT (kind, slug) DO NOTHING;

-- 3. tasks 테이블에 provider_slug, model_slug 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider_slug TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS model_slug TEXT;

-- 4. task_logs: agent_id → provider_slug, model_id → model_slug rename
ALTER TABLE task_logs RENAME COLUMN agent_id TO provider_slug;
ALTER TABLE task_logs RENAME COLUMN model_id TO model_slug;
