PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal','group','public','inherit')),
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT folders_no_inherit_root
    CHECK (parent_id IS NOT NULL OR visibility != 'inherit')
);

CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_visibility ON folders(visibility);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('superuser','admin','editor','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_group_members (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  last_used_at TEXT,
  expires_at TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS instructions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  agent_type TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  visibility_override TEXT
    CHECK (visibility_override IN ('personal','group','public')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '{}',
  owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  parent_workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  family_root_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  evaluation_contract TEXT DEFAULT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  visibility_override TEXT
    CHECK (visibility_override IN ('personal','group','public')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  instruction_id INTEGER REFERENCES instructions(id) ON DELETE RESTRICT,
  step_order INTEGER NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'action',
  title TEXT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  loop_back_to INTEGER,
  auto_advance INTEGER NOT NULL DEFAULT 0,
  hitl INTEGER NOT NULL DEFAULT 0,
  visual_selection INTEGER NOT NULL DEFAULT 0,
  version_note TEXT DEFAULT NULL,
  credential_id INTEGER REFERENCES credentials(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS folder_shares (
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('reader','contributor')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (folder_id, group_id)
);

CREATE TABLE IF NOT EXISTS credential_shares (
  credential_id INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('use','manage')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (credential_id, group_id)
);

CREATE TABLE IF NOT EXISTS workflow_shares (
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'reader'
    CHECK (access_level IN ('reader','contributor')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (workflow_id, group_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TEXT,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agent_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('provider','model')),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (kind, slug)
);

INSERT OR IGNORE INTO agent_registry (kind, slug, display_name, is_builtin) VALUES
  ('provider', 'claude-code', 'Claude Code', 1),
  ('provider', 'codex-cli', 'Codex CLI', 1),
  ('provider', 'gemini-cli', 'Gemini CLI', 1),
  ('provider', 'cursor', 'Cursor', 1),
  ('provider', 'windsurf', 'Windsurf', 1),
  ('provider', 'antigravity', 'Antigravity', 1),
  ('provider', 'opencode', 'OpenCode', 1),
  ('model', 'claude-opus-4-6', 'Claude Opus 4.6', 1),
  ('model', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 1),
  ('model', 'claude-haiku-4-5', 'Claude Haiku 4.5', 1),
  ('model', 'gpt-5.2', 'GPT-5.2', 1),
  ('model', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 1);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 0,
  context TEXT NOT NULL DEFAULT '',
  running_context TEXT NOT NULL DEFAULT '{}',
  session_meta TEXT NOT NULL DEFAULT '{}',
  provider_slug TEXT,
  model_slug TEXT,
  target_meta TEXT DEFAULT NULL,
  feedback_data TEXT DEFAULT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES workflow_nodes(id),
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  rule_id TEXT,
  severity TEXT,
  output TEXT NOT NULL DEFAULT '',
  visual_html TEXT,
  web_response TEXT,
  node_title TEXT NOT NULL DEFAULT '',
  node_type TEXT NOT NULL DEFAULT 'action',
  context_snapshot TEXT,
  session_id TEXT,
  provider_slug TEXT,
  user_name TEXT,
  model_slug TEXT,
  structured_output TEXT DEFAULT NULL,
  approval_requested_at TEXT,
  approved_at TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS node_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  content_binary BLOB,
  storage_type TEXT NOT NULL DEFAULT 'db'
    CHECK (storage_type IN ('db','file','s3')),
  storage_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS workflow_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  score_quantitative REAL,
  score_qualitative REAL,
  score_total REAL,
  details TEXT NOT NULL DEFAULT '{}',
  evaluated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS task_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'file',
  title TEXT NOT NULL,
  file_path TEXT,
  git_ref TEXT,
  git_branch TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  rule_id TEXT,
  severity TEXT,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS compliance_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER IF NOT EXISTS trg_folder_depth_insert
BEFORE INSERT ON folders
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM folders WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Folder nesting limited to 2 levels');
END;

CREATE TRIGGER IF NOT EXISTS trg_folder_depth_update
BEFORE UPDATE OF parent_id ON folders
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM folders WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Folder nesting limited to 2 levels');
END;

CREATE TRIGGER IF NOT EXISTS trg_credential_not_public_insert
BEFORE INSERT ON credentials
FOR EACH ROW
WHEN NEW.folder_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM folders WHERE id = NEW.folder_id AND visibility = 'public')
BEGIN
  SELECT RAISE(ABORT, 'Credentials cannot be placed in public folders');
END;

CREATE TRIGGER IF NOT EXISTS trg_credential_not_public_update
BEFORE UPDATE OF folder_id ON credentials
FOR EACH ROW
WHEN NEW.folder_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM folders WHERE id = NEW.folder_id AND visibility = 'public')
BEGIN
  SELECT RAISE(ABORT, 'Credentials cannot be placed in public folders');
END;

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_credential ON workflow_nodes(credential_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_node_id ON task_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_task ON compliance_findings(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_rule ON compliance_findings(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_step ON compliance_findings(task_id, step_order);
CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service_name);
CREATE INDEX IF NOT EXISTS idx_workflows_parent ON workflows(parent_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_version ON workflows(version);
CREATE INDEX IF NOT EXISTS idx_workflows_family_root ON workflows(family_root_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_workflows_family_active ON workflows(family_root_id) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_folder ON workflows(folder_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_task ON workflow_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_workflow ON workflow_evaluations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_shares_group ON workflow_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_folder_shares_group ON folder_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_credential_shares_group ON credential_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_instructions_owner ON instructions(owner_id);
CREATE INDEX IF NOT EXISTS idx_instructions_folder ON instructions(folder_id);
CREATE INDEX IF NOT EXISTS idx_credentials_owner ON credentials(owner_id);
CREATE INDEX IF NOT EXISTS idx_credentials_folder ON credentials(folder_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_pending ON invites(expires_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_node_attachments_node ON node_attachments(node_id);
