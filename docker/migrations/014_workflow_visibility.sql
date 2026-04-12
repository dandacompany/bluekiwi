-- 014: Expand workflow/instruction visibility_override to full Visibility enum
--      Add workflow_shares table for group-level access control

-- Workflows: drop the old 'personal-only' check, add full visibility check
ALTER TABLE workflows
  DROP CONSTRAINT IF EXISTS workflows_visibility_override_check;

ALTER TABLE workflows
  ADD CONSTRAINT workflows_visibility_override_check
  CHECK (visibility_override IN ('personal', 'group', 'public'));

-- Instructions: same expansion
ALTER TABLE instructions
  DROP CONSTRAINT IF EXISTS instructions_visibility_override_check;

ALTER TABLE instructions
  ADD CONSTRAINT instructions_visibility_override_check
  CHECK (visibility_override IN ('personal', 'group', 'public'));

-- Workflow shares (mirrors folder_shares)
CREATE TABLE IF NOT EXISTS workflow_shares (
  workflow_id  INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  access_level TEXT    NOT NULL DEFAULT 'viewer'
    CHECK (access_level IN ('viewer', 'editor')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_shares_group ON workflow_shares(group_id);
