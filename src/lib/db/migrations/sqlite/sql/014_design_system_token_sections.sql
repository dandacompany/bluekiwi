-- 014: Split design-system tokens into editable sections (SQLite)

ALTER TABLE design_system_versions
  ADD COLUMN color_tokens_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE design_system_versions
  ADD COLUMN typography_tokens_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE design_system_versions
  ADD COLUMN component_tokens_json TEXT NOT NULL DEFAULT '{}';
