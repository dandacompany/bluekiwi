-- OmegaRod PostgreSQL Schema
-- docker-entrypoint-initdb.d에 의해 자동 실행

CREATE TABLE IF NOT EXISTS instructions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  agent_type TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credentials (
  id SERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chains (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  parent_chain_id INTEGER REFERENCES chains(id) ON DELETE SET NULL,
  evaluation_contract JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_nodes (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  instruction_id INTEGER REFERENCES instructions(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'action',
  title TEXT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  loop_back_to INTEGER,
  auto_advance INTEGER NOT NULL DEFAULT 0,
  credential_id INTEGER REFERENCES credentials(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('superuser', 'admin', 'editor', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_group_members (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL REFERENCES chains(id),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 0,
  context TEXT NOT NULL DEFAULT '',
  running_context TEXT NOT NULL DEFAULT '{}',
  session_meta TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES chain_nodes(id),
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  output TEXT NOT NULL DEFAULT '',
  visual_html TEXT,
  web_response TEXT,
  node_title TEXT NOT NULL DEFAULT '',
  node_type TEXT NOT NULL DEFAULT 'action',
  context_snapshot TEXT,
  session_id TEXT,
  agent_id TEXT,
  user_name TEXT,
  model_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  structured_output JSONB DEFAULT NULL
);

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

CREATE TABLE IF NOT EXISTS task_artifacts (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'file',
  title TEXT NOT NULL,
  file_path TEXT,
  git_ref TEXT,
  git_branch TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chain_nodes_chain_id ON chain_nodes(chain_id);
CREATE INDEX IF NOT EXISTS idx_tasks_chain_id ON tasks(chain_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_node_id ON task_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service_name);
CREATE INDEX IF NOT EXISTS idx_chain_nodes_credential ON chain_nodes(credential_id);
CREATE INDEX IF NOT EXISTS idx_chains_parent ON chains(parent_chain_id);
CREATE INDEX IF NOT EXISTS idx_chains_version ON chains(version);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_task ON workflow_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_chain ON workflow_evaluations(chain_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
