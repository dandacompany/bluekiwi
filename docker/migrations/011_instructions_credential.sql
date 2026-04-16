-- 011: Add optional credential_id to instructions
ALTER TABLE instructions ADD COLUMN IF NOT EXISTS credential_id INTEGER REFERENCES credentials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_instructions_credential ON instructions(credential_id);
