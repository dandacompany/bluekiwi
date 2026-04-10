-- Migration 003: Rename chains → workflows, chain_nodes → workflow_nodes
-- All column and index references updated accordingly

-- 1. Rename tables
ALTER TABLE chains RENAME TO workflows;
ALTER TABLE chain_nodes RENAME TO workflow_nodes;

-- 2. Rename columns
ALTER TABLE workflow_nodes RENAME COLUMN chain_id TO workflow_id;
ALTER TABLE tasks RENAME COLUMN chain_id TO workflow_id;
ALTER TABLE workflows RENAME COLUMN parent_chain_id TO parent_workflow_id;
ALTER TABLE workflow_evaluations RENAME COLUMN chain_id TO workflow_id;

-- 3. Rename indexes
ALTER INDEX idx_chain_nodes_chain_id RENAME TO idx_workflow_nodes_workflow_id;
ALTER INDEX idx_tasks_chain_id RENAME TO idx_tasks_workflow_id;
ALTER INDEX idx_chain_nodes_credential RENAME TO idx_workflow_nodes_credential;
ALTER INDEX idx_chains_parent RENAME TO idx_workflows_parent;
ALTER INDEX idx_chains_version RENAME TO idx_workflows_version;
ALTER INDEX idx_workflow_evals_chain RENAME TO idx_workflow_evals_workflow;
