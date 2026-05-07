-- 017: Design-system change events (PostgreSQL)

CREATE TABLE IF NOT EXISTS design_system_events (
  id BIGSERIAL PRIMARY KEY,
  design_system_id INTEGER NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_system_events_system ON design_system_events(design_system_id);
CREATE INDEX IF NOT EXISTS idx_design_system_events_actor ON design_system_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_design_system_events_created ON design_system_events(created_at);
