-- 015: Add design-system taxonomy metadata

ALTER TABLE design_systems
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Custom';

ALTER TABLE design_systems
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'web';

DO $$
BEGIN
  ALTER TABLE design_systems
    ADD CONSTRAINT design_systems_surface_check
    CHECK (surface IN ('web','image','video','audio','slides','docs'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_design_systems_category ON design_systems(category);
CREATE INDEX IF NOT EXISTS idx_design_systems_surface ON design_systems(surface);
