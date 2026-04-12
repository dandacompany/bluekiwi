-- Migration 015: rename folder/workflow share access_level values
-- 'viewer' → 'reader', 'editor' → 'contributor'
-- Reason: disambiguate from system roles (viewer/editor) which are different concepts.

-- folder_shares
ALTER TABLE folder_shares DROP CONSTRAINT IF EXISTS folder_shares_access_level_check;
UPDATE folder_shares SET access_level = 'reader'      WHERE access_level = 'viewer';
UPDATE folder_shares SET access_level = 'contributor' WHERE access_level = 'editor';
ALTER TABLE folder_shares ADD CONSTRAINT folder_shares_access_level_check
  CHECK (access_level IN ('reader', 'contributor'));

-- workflow_shares
ALTER TABLE workflow_shares DROP CONSTRAINT IF EXISTS workflow_shares_access_level_check;
UPDATE workflow_shares SET access_level = 'reader'      WHERE access_level = 'viewer';
UPDATE workflow_shares SET access_level = 'contributor' WHERE access_level = 'editor';
ALTER TABLE workflow_shares ADD CONSTRAINT workflow_shares_access_level_check
  CHECK (access_level IN ('reader', 'contributor'));
