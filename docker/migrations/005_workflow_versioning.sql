-- 005_workflow_versioning.sql
-- Adds version lifecycle (is_active) and fast family lookup (family_root_id)
-- to the workflows table. Backfills family_root_id by walking the
-- parent_workflow_id chain to the root for each existing row.

BEGIN;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS family_root_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL;

-- Backfill family_root_id: walk the parent chain via recursive CTE.
-- Each workflow's family root is the topmost ancestor reachable by
-- following parent_workflow_id repeatedly. Rows with no parent are their own root.
WITH RECURSIVE lineage AS (
  SELECT id, id AS root_id, parent_workflow_id
  FROM workflows
  WHERE parent_workflow_id IS NULL
  UNION ALL
  SELECT w.id, l.root_id, w.parent_workflow_id
  FROM workflows w
  JOIN lineage l ON w.parent_workflow_id = l.id
)
UPDATE workflows w
SET family_root_id = l.root_id
FROM lineage l
WHERE w.id = l.id
  AND (w.family_root_id IS NULL OR w.family_root_id <> l.root_id);

-- Any rows still NULL (shouldn't happen, but safe): self-root them.
UPDATE workflows SET family_root_id = id WHERE family_root_id IS NULL;

-- Enforce NOT NULL after backfill so future inserts must supply the column.
ALTER TABLE workflows
  ALTER COLUMN family_root_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_family_root ON workflows(family_root_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_family_active
  ON workflows(family_root_id) WHERE is_active = TRUE;

COMMIT;
