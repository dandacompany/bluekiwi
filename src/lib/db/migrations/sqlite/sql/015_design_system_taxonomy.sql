-- 015: Add design-system taxonomy metadata (SQLite)

ALTER TABLE design_systems
  ADD COLUMN category TEXT NOT NULL DEFAULT 'Custom';

ALTER TABLE design_systems
  ADD COLUMN surface TEXT NOT NULL DEFAULT 'web'
    CHECK (surface IN ('web','image','video','audio','slides','docs'));

CREATE INDEX IF NOT EXISTS idx_design_systems_category ON design_systems(category);
CREATE INDEX IF NOT EXISTS idx_design_systems_surface ON design_systems(surface);
