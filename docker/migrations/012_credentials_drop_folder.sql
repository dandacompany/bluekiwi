-- 012: Drop folder_id from credentials (credentials are no longer filed in folders)
--
-- Context: credentials are managed via credential_shares and ownership only.
-- Folder-based organization was removed from the UI/API; this migration
-- drops the schema artifacts that supported it. Existing credentials keep
-- their data; only the folder assignment is lost (which had no user-facing
-- effect beyond filing).

BEGIN;

-- Trigger + function that prevented credentials from being filed in public folders
DROP TRIGGER IF EXISTS trg_credential_not_public ON credentials;
DROP FUNCTION IF EXISTS enforce_credential_not_public();

-- Index over folder_id
DROP INDEX IF EXISTS idx_credentials_folder;

-- Column (implicitly drops the FK to folders)
ALTER TABLE credentials DROP COLUMN IF EXISTS folder_id;

COMMIT;
