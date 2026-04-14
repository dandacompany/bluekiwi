ALTER TABLE workflow_nodes
  ADD COLUMN IF NOT EXISTS credential_requirement TEXT;
