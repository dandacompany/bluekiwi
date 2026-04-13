/**
 * Seed built-in workflows on first setup.
 *
 * Reads JSON files from docker/seed-workflows/ and inserts them
 * as workflows owned by the given user in the given folder.
 * Idempotent — skips if a workflow with the same title already exists.
 */

import { query, queryOne, execute } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

interface SeedNode {
  step_order: number;
  node_type: "action" | "gate" | "loop";
  title: string;
  instruction: string;
  loop_back_to: number | null;
  hitl: boolean;
  visual_selection: boolean;
}

interface SeedWorkflow {
  title: string;
  description: string;
  version: string;
  category?: string;
  nodes: SeedNode[];
}

export async function seedBuiltinWorkflows(
  ownerId: number,
  folderId: number,
): Promise<number> {
  // Resolve seed directory — works both in dev (project root) and production (standalone)
  const candidates = [
    path.resolve(process.cwd(), "docker/seed-workflows"),
    path.resolve(__dirname, "../../docker/seed-workflows"),
  ];
  const seedDir = candidates.find((d) => fs.existsSync(d));
  if (!seedDir) return 0;

  const files = fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  // Resolve or create category sub-folders under the parent folder
  const categoryFolderIds = new Map<string, number>();

  async function resolveFolderId(category?: string): Promise<number> {
    if (!category) return folderId;

    const cached = categoryFolderIds.get(category);
    if (cached) return cached;

    // Re-use existing sub-folder if present
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND owner_id = $3 LIMIT 1`,
      [category, folderId, ownerId],
    );
    if (existing) {
      categoryFolderIds.set(category, existing.id);
      return existing.id;
    }

    // Create sub-folder
    const rows = await query<{ id: number }>(
      `INSERT INTO folders (name, description, owner_id, parent_id, visibility)
       VALUES ($1, '', $2, $3, 'inherit')
       RETURNING id`,
      [category, ownerId, folderId],
    );
    categoryFolderIds.set(category, rows[0].id);
    return rows[0].id;
  }

  let seeded = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(seedDir, file), "utf-8");
    const wf: SeedWorkflow = JSON.parse(raw);

    // Skip if already exists (idempotent)
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM workflows WHERE title = $1 AND owner_id = $2 LIMIT 1",
      [wf.title, ownerId],
    );
    if (existing) continue;

    const targetFolderId = await resolveFolderId(wf.category);

    // Insert workflow
    const rows = await query<{ id: number }>(
      `INSERT INTO workflows (title, description, version, owner_id, folder_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [wf.title, wf.description, wf.version, ownerId, targetFolderId],
    );
    const workflowId = rows[0].id;

    // Set family_root_id to self
    await execute("UPDATE workflows SET family_root_id = $1 WHERE id = $1", [
      workflowId,
    ]);

    // Insert nodes
    for (const node of wf.nodes) {
      await execute(
        `INSERT INTO workflow_nodes
           (workflow_id, step_order, node_type, title, instruction,
            loop_back_to, auto_advance, hitl, visual_selection)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workflowId,
          node.step_order,
          node.node_type,
          node.title,
          node.instruction,
          node.loop_back_to ?? null,
          node.node_type === "action" && !node.hitl ? 1 : 0,
          node.hitl ?? false,
          node.visual_selection ?? false,
        ],
      );
    }

    seeded++;
  }

  return seeded;
}
