-- 018_node_attachments.sql
-- File attachments for workflow nodes (scripts, reference docs, configs)

CREATE TABLE IF NOT EXISTS node_attachments (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  content_binary BYTEA,
  storage_type TEXT NOT NULL DEFAULT 'db'
    CHECK (storage_type IN ('db', 'file', 's3')),
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_attachments_node ON node_attachments(node_id);
