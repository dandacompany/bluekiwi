-- 017: Design-system change events (SQLite)

CREATE TABLE IF NOT EXISTS design_system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_system_id INTEGER NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_design_system_events_system ON design_system_events(design_system_id);
CREATE INDEX IF NOT EXISTS idx_design_system_events_actor ON design_system_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_design_system_events_created ON design_system_events(created_at);
