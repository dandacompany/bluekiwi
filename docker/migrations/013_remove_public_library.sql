-- Migration 013: Remove Public Library system folder
-- The Public Library is redundant because users can set any folder to public visibility.
-- Existing contents are reassigned to the owner's My Workspace before deletion.

DO $$
DECLARE
  lib RECORD;
  workspace_id INTEGER;
BEGIN
  -- For each Public Library system folder, move its contents to the owner's My Workspace
  FOR lib IN
    SELECT id, owner_id FROM folders
    WHERE is_system = true AND visibility = 'public'
  LOOP
    -- Find the owner's My Workspace
    SELECT id INTO workspace_id
    FROM folders
    WHERE owner_id = lib.owner_id AND is_system = true AND visibility = 'personal'
    LIMIT 1;

    IF workspace_id IS NOT NULL THEN
      -- Reassign workflows
      UPDATE workflows SET folder_id = workspace_id WHERE folder_id = lib.id;
      -- Reassign instructions
      UPDATE instructions SET folder_id = workspace_id WHERE folder_id = lib.id;
      -- Reassign credentials
      UPDATE credentials SET folder_id = workspace_id WHERE folder_id = lib.id;
    END IF;

    -- Remove any folder shares pointing to this folder
    DELETE FROM folder_shares WHERE folder_id = lib.id;

    -- Delete child folders (move their contents up first)
    UPDATE folders SET parent_id = NULL WHERE parent_id = lib.id;

    -- Delete the Public Library folder
    DELETE FROM folders WHERE id = lib.id;
  END LOOP;
END $$;
