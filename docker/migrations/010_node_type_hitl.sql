-- 010_node_type_hitl.sql
-- node_type UX 재설계: hitl 컬럼 추가 + auto_advance 정규화

-- 1. hitl 컬럼 추가 (action 노드 전용: 수동 승인 여부)
ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS hitl BOOLEAN NOT NULL DEFAULT false;

-- 2. 기존 데이터 정규화: node_type에 따라 auto_advance 강제 설정
UPDATE workflow_nodes SET auto_advance = 1 WHERE node_type = 'action';
UPDATE workflow_nodes SET auto_advance = 0 WHERE node_type = 'gate';
-- loop는 기존 값 유지
