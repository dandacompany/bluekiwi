-- Allow folders to inherit visibility from their parent folder.
-- Top-level folders (parent_id IS NULL) must not use 'inherit'.

ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_visibility_check;
ALTER TABLE folders ADD CONSTRAINT folders_visibility_check
  CHECK (visibility IN ('personal','group','public','inherit'));

-- Default child folders to 'inherit'
UPDATE folders SET visibility = 'inherit'
  WHERE parent_id IS NOT NULL AND visibility = 'personal';

-- Safety: ensure no top-level folder has 'inherit'
ALTER TABLE folders ADD CONSTRAINT folders_no_inherit_root
  CHECK (parent_id IS NOT NULL OR visibility != 'inherit');
