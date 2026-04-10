import { describe, it, expect, beforeAll } from "vitest";
import { query, queryOne } from "../src/lib/db";

describe("migration 007 — ownership backfill", () => {
  it("creates Public Library folder", async () => {
    const folder = await queryOne<{
      id: number;
      name: string;
      visibility: string;
      is_system: boolean;
    }>(
      "SELECT id, name, visibility, is_system FROM folders WHERE is_system = true AND visibility = 'public' LIMIT 1",
    );
    expect(folder).toBeDefined();
    expect(folder?.name).toBe("Public Library");
    expect(folder?.is_system).toBe(true);
  });

  it("creates My Workspace per active user", async () => {
    const users = await query<{ id: number }>(
      "SELECT id FROM users WHERE is_active = true",
    );
    for (const u of users) {
      const mw = await queryOne<{ id: number }>(
        "SELECT id FROM folders WHERE owner_id = $1 AND name = 'My Workspace' AND is_system = true",
        [u.id],
      );
      expect(mw, `user ${u.id} should have My Workspace`).toBeDefined();
    }
  });

  it("all workflows have owner_id and folder_id", async () => {
    const bad = await query(
      "SELECT id FROM workflows WHERE owner_id IS NULL OR folder_id IS NULL",
    );
    expect(bad).toHaveLength(0);
  });

  it("all instructions live in Public Library by default", async () => {
    const publicLib = await queryOne<{ id: number }>(
      "SELECT id FROM folders WHERE is_system = true AND visibility = 'public' LIMIT 1",
    );
    const orphans = await query(
      "SELECT id FROM instructions WHERE folder_id <> $1 AND owner_id = (SELECT id FROM users WHERE role='superuser' ORDER BY id LIMIT 1)",
      [publicLib!.id],
    );
    expect(orphans).toHaveLength(0);
  });

  it("all credentials have owner_id and folder_id", async () => {
    const bad = await query(
      "SELECT id FROM credentials WHERE owner_id IS NULL OR folder_id IS NULL",
    );
    expect(bad).toHaveLength(0);
  });
});
