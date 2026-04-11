-- 012_visual_selection.sql
-- Visual Selection: gate 노드에서 HTML 기반 클릭 선택 UI 지원

ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS visual_selection BOOLEAN NOT NULL DEFAULT false;
