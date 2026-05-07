-- 013: Design system registry (SQLite)

CREATE TABLE IF NOT EXISTS design_systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  parent_design_system_id INTEGER REFERENCES design_systems(id) ON DELETE SET NULL,
  family_root_id INTEGER REFERENCES design_systems(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  owner_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  folder_id INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  visibility_override TEXT
    CHECK (visibility_override IN ('personal','group','public')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS design_system_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_system_id INTEGER NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  schema_json TEXT NOT NULL DEFAULT '{}',
  tokens_json TEXT NOT NULL DEFAULT '{}',
  guidelines_markdown TEXT NOT NULL DEFAULT '',
  skill_markdown TEXT NOT NULL DEFAULT '',
  export_manifest_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS design_system_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_system_id INTEGER NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES design_system_versions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('logo','image','css','template','reference','other')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  content_text TEXT,
  content_base64 TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (content_text IS NOT NULL AND content_base64 IS NULL)
    OR (content_text IS NULL AND content_base64 IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_design_systems_owner ON design_systems(owner_id);
CREATE INDEX IF NOT EXISTS idx_design_systems_folder ON design_systems(folder_id);
CREATE INDEX IF NOT EXISTS idx_design_systems_slug ON design_systems(owner_id, folder_id, slug);
CREATE INDEX IF NOT EXISTS idx_design_systems_family_root ON design_systems(family_root_id);
CREATE INDEX IF NOT EXISTS idx_design_systems_family_active ON design_systems(family_root_id) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_design_system_versions_system ON design_system_versions(design_system_id);
CREATE INDEX IF NOT EXISTS idx_design_system_assets_system ON design_system_assets(design_system_id);
CREATE INDEX IF NOT EXISTS idx_design_system_assets_version ON design_system_assets(version_id);

