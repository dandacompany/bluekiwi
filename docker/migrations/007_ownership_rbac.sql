-- Migration 007: Ownership + RBAC (folders, shares, owner_id, folder_id)
-- Spec: docs/superpowers/specs/2026-04-10-workflow-instruction-rbac-design.md
-- REQUIRES: at least one superuser user in the users table. Migration fails
-- with a clear error if none exists.

BEGIN;

-- ─── Folders ───
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal','group','public')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_owner      ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent     ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_visibility ON folders(visibility);

-- ─── Folder shares (group-scoped) ───
CREATE TABLE IF NOT EXISTS folder_shares (
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('viewer','editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (folder_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_folder_shares_group ON folder_shares(group_id);

-- ─── Credential shares (use/manage) ───
CREATE TABLE IF NOT EXISTS credential_shares (
  credential_id INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('use','manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (credential_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_credential_shares_group ON credential_shares(group_id);

-- ─── Add owner/folder columns (NULL allowed for backfill) ───
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS visibility_override TEXT
    CHECK (visibility_override IN ('personal'));

ALTER TABLE instructions
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS visibility_override TEXT
    CHECK (visibility_override IN ('personal'));

ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT;

-- ─── Backfill block ───
DO $$
DECLARE
  system_owner_id INTEGER;
  public_library_id INTEGER;
BEGIN
  SELECT id INTO system_owner_id
  FROM users WHERE role = 'superuser' ORDER BY id LIMIT 1;

  IF system_owner_id IS NULL THEN
    RAISE EXCEPTION 'Migration 007 requires at least one superuser account. Create one and retry.';
  END IF;

  -- Public Library (shared, public)
  INSERT INTO folders (name, description, owner_id, parent_id, visibility, is_system)
  VALUES ('Public Library', 'Shared library of public instructions and workflows.',
          system_owner_id, NULL, 'public', true)
  RETURNING id INTO public_library_id;

  -- My Workspace per active user
  INSERT INTO folders (name, description, owner_id, parent_id, visibility, is_system)
  SELECT 'My Workspace', 'Your personal workspace.', id, NULL, 'personal', true
  FROM users
  WHERE is_active = true;

  -- Backfill workflows → system_owner's My Workspace
  UPDATE workflows
  SET owner_id = system_owner_id,
      folder_id = (
        SELECT id FROM folders
        WHERE owner_id = system_owner_id AND name = 'My Workspace' AND is_system = true
        LIMIT 1
      )
  WHERE owner_id IS NULL;

  -- Backfill instructions → Public Library (preserves backward compat)
  UPDATE instructions
  SET owner_id = system_owner_id,
      folder_id = public_library_id
  WHERE owner_id IS NULL;

  -- Backfill credentials → system_owner's My Workspace (credentials cannot be public)
  UPDATE credentials
  SET owner_id = system_owner_id,
      folder_id = (
        SELECT id FROM folders
        WHERE owner_id = system_owner_id AND name = 'My Workspace' AND is_system = true
        LIMIT 1
      )
  WHERE owner_id IS NULL;
END $$;

-- ─── Enforce NOT NULL after backfill ───
ALTER TABLE workflows ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE workflows ALTER COLUMN folder_id SET NOT NULL;
ALTER TABLE instructions ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE instructions ALTER COLUMN folder_id SET NOT NULL;
ALTER TABLE credentials ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE credentials ALTER COLUMN folder_id SET NOT NULL;

-- ─── Indexes on new columns ───
CREATE INDEX IF NOT EXISTS idx_workflows_owner     ON workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_folder    ON workflows(folder_id);
CREATE INDEX IF NOT EXISTS idx_instructions_owner  ON instructions(owner_id);
CREATE INDEX IF NOT EXISTS idx_instructions_folder ON instructions(folder_id);
CREATE INDEX IF NOT EXISTS idx_credentials_owner   ON credentials(owner_id);
CREATE INDEX IF NOT EXISTS idx_credentials_folder  ON credentials(folder_id);

-- ─── Trigger: 2-level folder depth limit ───
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

-- ─── Trigger: credentials cannot live in public folders ───
CREATE OR REPLACE FUNCTION enforce_credential_not_public()
RETURNS TRIGGER AS $$
DECLARE
  fv TEXT;
BEGIN
  SELECT visibility INTO fv FROM folders WHERE id = NEW.folder_id;
  IF fv = 'public' THEN
    RAISE EXCEPTION 'Credentials cannot be placed in public folders';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credential_not_public ON credentials;
CREATE TRIGGER trg_credential_not_public
BEFORE INSERT OR UPDATE ON credentials
FOR EACH ROW EXECUTE FUNCTION enforce_credential_not_public();

COMMIT;
