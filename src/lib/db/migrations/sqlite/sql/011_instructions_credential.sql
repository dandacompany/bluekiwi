-- 011: Add credential_id to instructions (SQLite)
--
-- Mirror of docker/migrations/011_instructions_credential.sql.
-- The runner already wraps this in a transaction and has foreign_keys=ON.
-- SQLite supports ADD COLUMN (not ADD COLUMN IF NOT EXISTS); the migration
-- ledger (schema_migrations) prevents re-run, so a bare ADD COLUMN is correct.

ALTER TABLE instructions ADD COLUMN credential_id INTEGER REFERENCES credentials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_instructions_credential ON instructions(credential_id);
