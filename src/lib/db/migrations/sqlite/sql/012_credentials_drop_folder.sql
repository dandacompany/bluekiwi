-- 012: Drop folder_id from credentials (SQLite)
--
-- Mirror of docker/migrations/012_credentials_drop_folder.sql.
-- The runner already wraps this in a transaction and has foreign_keys=ON.
-- ALTER TABLE DROP COLUMN is supported since SQLite 3.35 (2021); inline
-- column-level FOREIGN KEY on the dropped column is considered part of
-- the column definition and does not block DROP COLUMN.

DROP TRIGGER IF EXISTS trg_credential_not_public_insert;
DROP TRIGGER IF EXISTS trg_credential_not_public_update;
DROP INDEX IF EXISTS idx_credentials_folder;
ALTER TABLE credentials DROP COLUMN folder_id;
