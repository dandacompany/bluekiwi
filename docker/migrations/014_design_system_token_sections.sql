-- 014: Split design-system tokens into editable sections

ALTER TABLE design_system_versions
  ADD COLUMN IF NOT EXISTS color_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE design_system_versions
  ADD COLUMN IF NOT EXISTS typography_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE design_system_versions
  ADD COLUMN IF NOT EXISTS component_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE design_system_versions
SET
  color_tokens_json = COALESCE(NULLIF(tokens_json -> 'color', 'null'::jsonb), color_tokens_json),
  typography_tokens_json = COALESCE(NULLIF(tokens_json -> 'typography', 'null'::jsonb), typography_tokens_json),
  component_tokens_json = COALESCE(NULLIF(tokens_json -> 'components', 'null'::jsonb), component_tokens_json)
WHERE tokens_json IS NOT NULL;
