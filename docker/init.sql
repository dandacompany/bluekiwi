-- ============================================================
-- BlueKiwi PostgreSQL Schema — Docker Fresh Install
-- ============================================================
-- Loaded automatically by docker-entrypoint-initdb.d on first
-- container start. Creates the complete schema and pre-marks
-- 001_initial_schema.sql as applied so the migration runner
-- does not re-run it.
--
-- ⚠️  KEEP IN SYNC WITH docker/migrations/001_initial_schema.sql
--     Any schema change must be reflected in BOTH files plus a
--     new incremental migration file (002_*.sql, etc.).
-- ============================================================

-- ─── Folders (created first; self-referential) ───────────────

CREATE TABLE IF NOT EXISTS folders (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id    INTEGER NOT NULL,              -- FK added after users
  parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  visibility  TEXT NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal','group','public','inherit')),
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Child folders may use 'inherit'; root folders may not
  CONSTRAINT folders_no_inherit_root
    CHECK (parent_id IS NOT NULL OR visibility != 'inherit')
);

CREATE INDEX IF NOT EXISTS idx_folders_owner      ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent     ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_visibility ON folders(visibility);

-- ─── Users / Groups / API Keys ───────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE,
  email                TEXT UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('superuser','admin','editor','viewer')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred FK: folders.owner_id → users.id (tables now both exist)
ALTER TABLE folders
  ADD CONSTRAINT folders_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS user_groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_group_members (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id  INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_revoked   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Instructions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instructions (
  id                  SERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  content             TEXT NOT NULL DEFAULT '',
  agent_type          TEXT NOT NULL DEFAULT 'general',
  tags                TEXT NOT NULL DEFAULT '[]',
  priority            INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1,
  owner_id            INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id           INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  credential_id       INTEGER,
  visibility_override TEXT
    CHECK (visibility_override IN ('personal','group','public')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Credentials ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credentials (
  id           SERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  secrets      TEXT NOT NULL DEFAULT '{}',
  owner_id     INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK: instructions.credential_id → credentials (deferred because credentials defined after instructions)
ALTER TABLE instructions ADD CONSTRAINT instructions_credential_id_fkey
  FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_instructions_credential ON instructions(credential_id);

-- ─── Workflows ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflows (
  id                  SERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  version             TEXT NOT NULL DEFAULT '1.0',
  parent_workflow_id  INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  family_root_id      INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  evaluation_contract JSONB DEFAULT NULL,
  owner_id            INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id           INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  visibility_override TEXT
    CHECK (visibility_override IN ('personal','group','public')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflow Nodes ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id               SERIAL PRIMARY KEY,
  workflow_id      INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  instruction_id   INTEGER REFERENCES instructions(id) ON DELETE RESTRICT,
  step_order       INTEGER NOT NULL,
  node_type        TEXT NOT NULL DEFAULT 'action',
  title            TEXT NOT NULL,
  instruction      TEXT NOT NULL DEFAULT '',
  loop_back_to     INTEGER,
  auto_advance     INTEGER NOT NULL DEFAULT 0,
  hitl             BOOLEAN NOT NULL DEFAULT false,
  visual_selection BOOLEAN NOT NULL DEFAULT false,
  version_note     TEXT DEFAULT NULL,
  credential_id    INTEGER REFERENCES credentials(id) ON DELETE RESTRICT,
  credential_requirement TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Shares ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS folder_shares (
  folder_id    INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('reader','contributor')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (folder_id, group_id)
);

CREATE TABLE IF NOT EXISTS credential_shares (
  credential_id INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  group_id      INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level  TEXT NOT NULL CHECK (access_level IN ('use','manage')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (credential_id, group_id)
);

CREATE TABLE IF NOT EXISTS workflow_shares (
  workflow_id  INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'reader'
    CHECK (access_level IN ('reader','contributor')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow_id, group_id)
);

-- ─── Invites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invites (
  id          SERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Agent Registry ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_registry (
  id            SERIAL PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('provider','model')),
  slug          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  icon          TEXT,
  is_builtin    BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, slug)
);

INSERT INTO agent_registry (kind, slug, display_name, is_builtin) VALUES
  ('provider', 'claude-code',      'Claude Code',      true),
  ('provider', 'codex-cli',        'Codex CLI',         true),
  ('provider', 'gemini-cli',       'Gemini CLI',        true),
  ('provider', 'cursor',           'Cursor',            true),
  ('provider', 'windsurf',         'Windsurf',          true),
  ('provider', 'antigravity',      'Antigravity',       true),
  ('provider', 'opencode',         'OpenCode',          true),
  ('model',    'claude-opus-4-6',  'Claude Opus 4.6',   true),
  ('model',    'claude-sonnet-4-6','Claude Sonnet 4.6', true),
  ('model',    'claude-haiku-4-5', 'Claude Haiku 4.5',  true),
  ('model',    'gpt-5.2',          'GPT-5.2',           true),
  ('model',    'gemini-2.5-pro',   'Gemini 2.5 Pro',    true)
ON CONFLICT (kind, slug) DO NOTHING;

-- ─── Tasks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id              SERIAL PRIMARY KEY,
  workflow_id     INTEGER NOT NULL REFERENCES workflows(id),
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  current_step    INTEGER NOT NULL DEFAULT 0,
  title           VARCHAR(120),
  context         TEXT NOT NULL DEFAULT '',
  running_context TEXT NOT NULL DEFAULT '{}',
  session_meta    TEXT NOT NULL DEFAULT '{}',
  provider_slug   TEXT,
  model_slug      TEXT,
  target_meta     JSONB DEFAULT NULL,
  feedback_data   JSONB DEFAULT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_logs (
  id                    SERIAL PRIMARY KEY,
  task_id               INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_id               INTEGER NOT NULL REFERENCES workflow_nodes(id),
  step_order            INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'running',
  rule_id               TEXT,
  severity              TEXT,
  output                TEXT NOT NULL DEFAULT '',
  visual_html           TEXT,
  web_response          TEXT,
  node_title            TEXT NOT NULL DEFAULT '',
  node_type             TEXT NOT NULL DEFAULT 'action',
  context_snapshot      TEXT,
  session_id            TEXT,
  provider_slug         TEXT,
  user_name             TEXT,
  model_slug            TEXT,
  structured_output     JSONB DEFAULT NULL,
  approval_requested_at TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  approved_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS node_attachments (
  id             SERIAL PRIMARY KEY,
  node_id        INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  mime_type      TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes     INTEGER NOT NULL DEFAULT 0,
  content        TEXT,
  content_binary BYTEA,
  storage_type   TEXT NOT NULL DEFAULT 'db'
    CHECK (storage_type IN ('db','file','s3')),
  storage_path   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_evaluations (
  id                 SERIAL PRIMARY KEY,
  task_id            INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id        INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version            TEXT NOT NULL,
  score_quantitative REAL,
  score_qualitative  REAL,
  score_total        REAL,
  details            JSONB NOT NULL DEFAULT '{}',
  evaluated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_artifacts (
  id            SERIAL PRIMARY KEY,
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'file',
  title         TEXT NOT NULL,
  file_path     TEXT,
  git_ref       TEXT,
  git_branch    TEXT,
  url           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  rule_id    TEXT,
  severity   TEXT,
  comment    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_findings (
  id          SERIAL PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order  INTEGER,
  rule_id     TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('BLOCK','REVIEW','WARN','INFO')),
  summary     TEXT NOT NULL,
  detail      TEXT,
  fix         TEXT,
  authority   TEXT,
  file_path   TEXT,
  line_number INTEGER,
  source      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Triggers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_folder_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM folders WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Folder nesting limited to 2 levels';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_folder_depth ON folders;
CREATE TRIGGER trg_folder_depth
BEFORE INSERT OR UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION enforce_folder_depth();

-- ─── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_id   ON workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_credential    ON workflow_nodes(credential_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id            ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status                 ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user                   ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id            ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_node_id            ON task_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id       ON task_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id        ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_task     ON compliance_findings(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_rule     ON compliance_findings(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_step     ON compliance_findings(task_id, step_order);
CREATE INDEX IF NOT EXISTS idx_credentials_service          ON credentials(service_name);
CREATE INDEX IF NOT EXISTS idx_workflows_parent             ON workflows(parent_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_version            ON workflows(version);
CREATE INDEX IF NOT EXISTS idx_workflows_family_root        ON workflows(family_root_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active             ON workflows(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_family_active      ON workflows(family_root_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_owner              ON workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_folder             ON workflows(folder_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_task          ON workflow_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_evals_workflow      ON workflow_evaluations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_shares_group        ON workflow_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_users_role                   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username               ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user      ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group     ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user                ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix              ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash                ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_folder_shares_group          ON folder_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_credential_shares_group      ON credential_shares(group_id);
CREATE INDEX IF NOT EXISTS idx_instructions_owner           ON instructions(owner_id);
CREATE INDEX IF NOT EXISTS idx_instructions_folder          ON instructions(folder_id);
CREATE INDEX IF NOT EXISTS idx_credentials_owner            ON credentials(owner_id);
CREATE INDEX IF NOT EXISTS idx_invites_token                ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email                ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_pending              ON invites(expires_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_node_attachments_node        ON node_attachments(node_id);

-- ─── System Settings ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Migration tracking ───────────────────────────────────────
-- Pre-mark applied migrations so the runner skips them on fresh
-- Docker installs.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES
  ('001_initial_schema.sql'),
  ('002_system_settings.sql'),
  ('009_task_title.sql'),
  ('012_credentials_drop_folder.sql')
ON CONFLICT (filename) DO NOTHING;
