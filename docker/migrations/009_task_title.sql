-- Add a short display title to tasks, separate from the execution context.
-- Nullable so existing rows fall back to context substring in the UI.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title VARCHAR(120);
