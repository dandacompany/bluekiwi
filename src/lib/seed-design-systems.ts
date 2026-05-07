/**
 * Seed built-in design systems on first setup.
 *
 * Reads JSON files from docker/seed-design-systems/ and inserts them as
 * versioned registry records owned by the given user in the [Design Seeds]
 * sub-folder. Idempotent by owner + slug.
 */

import * as fs from "fs";
import * as path from "path";

import { insertAndReturnId, queryOne } from "@/lib/db";
import { createDesignSystem } from "@/lib/db/repositories/design-systems";

interface SeedDesignSystem {
  title: string;
  slug: string;
  description: string;
  version?: string;
  category?: string;
  surface?: string;
  schema?: unknown;
  tokens?: unknown;
  color_tokens?: unknown;
  typography_tokens?: unknown;
  component_tokens?: unknown;
  guidelines_markdown?: string;
  skill_markdown?: string;
  export_manifest?: unknown;
}

function resolveSeedDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "docker/seed-design-systems"),
    path.resolve(__dirname, "../../docker/seed-design-systems"),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? null;
}

function readSeedFiles(seedDir: string): SeedDesignSystem[] {
  return fs
    .readdirSync(seedDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const raw = fs.readFileSync(path.join(seedDir, file), "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as SeedDesignSystem[];
      return [parsed as SeedDesignSystem];
    });
}

export async function seedBuiltinDesignSystems(
  ownerId: number,
  folderId: number,
): Promise<number> {
  const seedDir = resolveSeedDir();
  if (!seedDir) return 0;

  const seedFolder = await queryOne<{ id: number }>(
    `SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND owner_id = $3 LIMIT 1`,
    ["[Design Seeds]", folderId, ownerId],
  );
  const seedFolderId =
    seedFolder?.id ??
    (await insertAndReturnId(
      `INSERT INTO folders (name, description, owner_id, parent_id, visibility)
       VALUES ($1, $2, $3, $4, 'inherit')`,
      [
        "[Design Seeds]",
        "Built-in design-system examples seeded during first-time setup.",
        ownerId,
        folderId,
      ],
    ));

  let seeded = 0;
  for (const item of readSeedFiles(seedDir)) {
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM design_systems WHERE owner_id = $1 AND slug = $2 LIMIT 1",
      [ownerId, item.slug],
    );
    if (existing) continue;

    await createDesignSystem({
      title: item.title,
      slug: item.slug,
      description: item.description,
      version: item.version,
      category: item.category,
      surface: item.surface,
      schema: item.schema,
      tokens: item.tokens,
      colorTokens: item.color_tokens,
      typographyTokens: item.typography_tokens,
      componentTokens: item.component_tokens,
      guidelinesMarkdown: item.guidelines_markdown,
      skillMarkdown: item.skill_markdown,
      exportManifest: item.export_manifest ?? {
        seed: true,
        source: "bluekiwi-core",
      },
      ownerId,
      folderId: seedFolderId,
    });
    seeded++;
  }

  return seeded;
}
