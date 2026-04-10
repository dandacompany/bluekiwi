-- Migration 008: Protect instructions and credentials from silent deletion
-- while still referenced by workflow_nodes.
--
-- Previously workflow_nodes.instruction_id / credential_id used ON DELETE SET NULL,
-- so deleting an instruction or credential silently nulled the references in every
-- workflow that used it. Credentials losing their secret with no warning is a
-- particularly nasty failure mode. This migration converts both FKs to RESTRICT
-- so the database refuses the delete; the application layer adds a friendlier
-- count-aware 409 guard on top of this.

BEGIN;

ALTER TABLE workflow_nodes
  DROP CONSTRAINT IF EXISTS chain_nodes_instruction_id_fkey;
ALTER TABLE workflow_nodes
  DROP CONSTRAINT IF EXISTS workflow_nodes_instruction_id_fkey;
ALTER TABLE workflow_nodes
  ADD CONSTRAINT workflow_nodes_instruction_id_fkey
  FOREIGN KEY (instruction_id) REFERENCES instructions(id) ON DELETE RESTRICT;

ALTER TABLE workflow_nodes
  DROP CONSTRAINT IF EXISTS chain_nodes_credential_id_fkey;
ALTER TABLE workflow_nodes
  DROP CONSTRAINT IF EXISTS workflow_nodes_credential_id_fkey;
ALTER TABLE workflow_nodes
  ADD CONSTRAINT workflow_nodes_credential_id_fkey
  FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE RESTRICT;

COMMIT;
