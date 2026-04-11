-- 011_feedback_version_note.sql
-- 피드백 설문 + 자동 개선: 피드백 저장 및 버전 노트 컬럼 추가

-- tasks 테이블: 피드백 데이터 저장
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS feedback_data JSONB DEFAULT NULL;

-- workflow_nodes 테이블: 버전별 수정 노트
ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS version_note TEXT DEFAULT NULL;
