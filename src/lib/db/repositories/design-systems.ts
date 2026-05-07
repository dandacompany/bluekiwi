import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import { insertAndReturnId, query, queryOne, withTransaction } from "@/lib/db";
import type {
  DesignSystem,
  DesignSystemAsset,
  DesignSystemAssetKind,
  DesignSystemStatus,
  DesignSystemVersion,
  Visibility,
} from "@/lib/db";

const SUPPORTED_ASSET_KINDS: DesignSystemAssetKind[] = [
  "logo",
  "image",
  "css",
  "template",
  "reference",
  "other",
];
const SUPPORTED_STATUSES: DesignSystemStatus[] = [
  "draft",
  "published",
  "archived",
];
const SUPPORTED_VISIBILITY_OVERRIDES: Array<Visibility | null> = [
  "personal",
  "group",
  "public",
  null,
];
const MAX_BASE64_ASSET_BYTES = 256 * 1024;

interface DesignSystemRow
  extends Omit<DesignSystem, "is_active" | "created_at" | "updated_at"> {
  is_active: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface DesignSystemVersionRow
  extends Omit<DesignSystemVersion, "created_at" | "updated_at"> {
  created_at: string | Date;
  updated_at: string | Date;
}

interface DesignSystemAssetRow
  extends Omit<DesignSystemAsset, "created_at" | "updated_at"> {
  created_at: string | Date;
  updated_at: string | Date;
}

export interface DesignSystemDetail extends DesignSystem {
  content: DesignSystemVersion;
  assets: DesignSystemAsset[];
}

export interface DesignSystemCreateInput {
  title: string;
  slug?: string;
  description?: string;
  version?: string;
  status?: DesignSystemStatus;
  schema?: unknown;
  tokens?: unknown;
  guidelinesMarkdown?: string;
  skillMarkdown?: string;
  exportManifest?: unknown;
  ownerId: number;
  folderId: number;
}

export interface DesignSystemUpdateInput {
  id: number;
  title?: string;
  slug?: string;
  description?: string;
  status?: DesignSystemStatus;
  visibilityOverride?: Visibility | null;
  schema?: unknown;
  tokens?: unknown;
  guidelinesMarkdown?: string;
  skillMarkdown?: string;
  exportManifest?: unknown;
}

export interface DesignSystemAssetInput {
  designSystemId: number;
  kind?: DesignSystemAssetKind;
  filename: string;
  mimeType: string;
  contentText?: string | null;
  contentBase64?: string | null;
}

function normalizeDesignSystem(row: DesignSystemRow): DesignSystem {
  return {
    ...row,
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeDesignSystemVersion(
  row: DesignSystemVersionRow,
): DesignSystemVersion {
  return {
    ...row,
    schema_json:
      typeof row.schema_json === "string"
        ? row.schema_json
        : JSON.stringify(row.schema_json ?? {}),
    tokens_json:
      typeof row.tokens_json === "string"
        ? row.tokens_json
        : JSON.stringify(row.tokens_json ?? {}),
    export_manifest_json:
      typeof row.export_manifest_json === "string"
        ? row.export_manifest_json
        : JSON.stringify(row.export_manifest_json ?? {}),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeDesignSystemAsset(
  row: DesignSystemAssetRow,
): DesignSystemAsset {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function jsonText(value: unknown): string {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "{}";
    JSON.parse(trimmed);
    return trimmed;
  }
  return JSON.stringify(value);
}

function optionalJsonText(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  return jsonText(value);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateSlug(slug: string): void {
  if (!slug || !/^[a-z0-9가-힣][a-z0-9가-힣-]{0,79}$/.test(slug)) {
    throw new Error(
      "slug must start with a letter/number and contain only letters, numbers, Korean characters, and hyphens",
    );
  }
}

function normalizeStatus(
  value: unknown,
  fallback: DesignSystemStatus,
): DesignSystemStatus {
  if (value === undefined || value === null) return fallback;
  if (
    typeof value === "string" &&
    SUPPORTED_STATUSES.includes(value as DesignSystemStatus)
  ) {
    return value as DesignSystemStatus;
  }
  throw new Error("status must be draft, published, or archived");
}

function normalizeVisibilityOverride(
  value: unknown,
  fallback: Visibility | null,
): Visibility | null {
  if (value === undefined) return fallback;
  if (SUPPORTED_VISIBILITY_OVERRIDES.includes(value as Visibility | null)) {
    return value as Visibility | null;
  }
  throw new Error("visibility_override must be personal, group, public, or null");
}

function incrementVersion(version: string): string {
  const match = version.trim().match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!match) return "1.0";
  const parts = match[1].split(".");
  const last = Number.parseInt(parts[parts.length - 1] ?? "0", 10);
  parts[parts.length - 1] = String(Number.isNaN(last) ? 1 : last + 1);
  return parts.join(".") + match[2];
}

function parseJsonObject<T = Record<string, unknown>>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

function yamlDoubleQuoted(value: string): string {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "")
    .replaceAll("\n", "\\n")}"`;
}

function validateAssetInput(input: DesignSystemAssetInput): {
  kind: DesignSystemAssetKind;
  sizeBytes: number;
} {
  const kind = input.kind ?? "other";
  if (!SUPPORTED_ASSET_KINDS.includes(kind)) {
    throw new Error(`unsupported asset kind: ${kind}`);
  }
  if (!input.filename.trim()) {
    throw new Error("filename is required");
  }
  if (!input.mimeType.trim()) {
    throw new Error("mime_type is required");
  }

  const hasText = input.contentText !== undefined && input.contentText !== null;
  const hasBase64 =
    input.contentBase64 !== undefined && input.contentBase64 !== null;
  if (hasText === hasBase64) {
    throw new Error("provide exactly one of content_text or content_base64");
  }

  const sizeBytes = hasBase64
    ? Buffer.byteLength(input.contentBase64 ?? "", "base64")
    : Buffer.byteLength(input.contentText ?? "", "utf8");

  if (hasBase64 && sizeBytes > MAX_BASE64_ASSET_BYTES) {
    throw new Error("base64 assets are limited to 256 KB in the MVP");
  }

  return { kind, sizeBytes };
}

async function findDesignSystemVersion(
  designSystemId: number,
): Promise<DesignSystemVersion | null> {
  const row = await queryOne<DesignSystemVersionRow>(
    "SELECT * FROM design_system_versions WHERE design_system_id = $1 ORDER BY id DESC LIMIT 1",
    [designSystemId],
  );
  return row ? normalizeDesignSystemVersion(row) : null;
}

async function listDesignSystemAssets(
  designSystemId: number,
): Promise<DesignSystemAsset[]> {
  const rows = await query<DesignSystemAssetRow>(
    "SELECT * FROM design_system_assets WHERE design_system_id = $1 ORDER BY id ASC",
    [designSystemId],
  );
  return rows.map(normalizeDesignSystemAsset);
}

export async function listDesignSystemsForVisibilityFilter(input: {
  filterSql: string;
  filterParams: unknown[];
  includeInactive?: boolean;
  folderId?: number;
  q?: string;
}): Promise<DesignSystem[]> {
  const clauses = [input.filterSql];
  const params: unknown[] = [...input.filterParams];

  if (!input.includeInactive) clauses.push("ds.is_active = TRUE");
  if (input.folderId !== undefined) {
    params.push(input.folderId);
    clauses.push(
      `ds.folder_id IN (
        WITH RECURSIVE ftree AS (
          SELECT id FROM folders WHERE id = $${params.length}
          UNION ALL
          SELECT f.id FROM folders f JOIN ftree ON f.parent_id = ftree.id
        )
        SELECT id FROM ftree
      )`,
    );
  }
  if (input.q) {
    params.push(`%${input.q}%`);
    clauses.push(
      `(LOWER(ds.title) LIKE LOWER($${params.length}) OR LOWER(ds.slug) LIKE LOWER($${params.length}))`,
    );
  }

  const rows = await query<DesignSystemRow>(
    `SELECT ds.* FROM design_systems ds WHERE ${clauses.join(" AND ")} ORDER BY ds.updated_at DESC`,
    params,
  );
  return rows.map(normalizeDesignSystem);
}

export async function findPersonalDesignSystemWorkspaceFolderId(
  userId: number,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
    [userId],
  );
  return row?.id ?? null;
}

export async function findDesignSystemById(
  id: number,
): Promise<DesignSystem | null> {
  const row = await queryOne<DesignSystemRow>(
    "SELECT * FROM design_systems WHERE id = $1",
    [id],
  );
  return row ? normalizeDesignSystem(row) : null;
}

export async function getDesignSystemDetail(
  id: number,
): Promise<DesignSystemDetail | null> {
  const designSystem = await findDesignSystemById(id);
  if (!designSystem) return null;
  const content = await findDesignSystemVersion(id);
  if (!content) return null;
  const assets = await listDesignSystemAssets(id);
  return { ...designSystem, content, assets };
}

export async function createDesignSystem(
  input: DesignSystemCreateInput,
): Promise<DesignSystemDetail> {
  const title = input.title.trim();
  if (!title) throw new Error("title is required");

  const slug = input.slug ? slugify(input.slug) : slugify(title);
  validateSlug(slug);

  const duplicate = await queryOne<{ id: number }>(
    "SELECT id FROM design_systems WHERE owner_id = $1 AND folder_id = $2 AND slug = $3 LIMIT 1",
    [input.ownerId, input.folderId, slug],
  );
  if (duplicate) throw new Error("design system slug already exists");

  const designSystemId = await withTransaction(async (client) => {
    const id = await insertAndReturnId(
      `INSERT INTO design_systems (
         title, slug, description, version, status, owner_id, folder_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        title,
        slug,
        input.description?.trim() ?? "",
        input.version?.trim() || "1.0",
        normalizeStatus(input.status, "draft"),
        input.ownerId,
        input.folderId,
      ],
      client,
    );

    await client.query(
      "UPDATE design_systems SET family_root_id = $1 WHERE id = $1",
      [id],
    );

    await client.query(
      `INSERT INTO design_system_versions (
         design_system_id, schema_json, tokens_json, guidelines_markdown,
         skill_markdown, export_manifest_json
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        jsonText(input.schema),
        jsonText(input.tokens),
        input.guidelinesMarkdown?.trim() ?? "",
        input.skillMarkdown?.trim() ?? "",
        jsonText(input.exportManifest),
      ],
    );

    return id;
  });

  const detail = await getDesignSystemDetail(designSystemId);
  if (!detail) throw new Error("Failed to load created design system");
  return detail;
}

export async function updateDesignSystem(
  input: DesignSystemUpdateInput,
): Promise<DesignSystemDetail> {
  const existing = await getDesignSystemDetail(input.id);
  if (!existing) throw new Error("design system not found");

  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : existing.title;
  const slug =
    typeof input.slug === "string" && input.slug.trim()
      ? slugify(input.slug)
      : existing.slug;
  validateSlug(slug);

  if (slug !== existing.slug) {
    const duplicate = await queryOne<{ id: number }>(
      "SELECT id FROM design_systems WHERE owner_id = $1 AND folder_id = $2 AND slug = $3 AND family_root_id <> $4 LIMIT 1",
      [existing.owner_id, existing.folder_id, slug, existing.family_root_id],
    );
    if (duplicate) throw new Error("design system slug already exists");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE design_systems
       SET title = $1, slug = $2, description = $3, status = $4,
           visibility_override = $5, updated_at = $6
       WHERE id = $7`,
      [
        title,
        slug,
        input.description === undefined
          ? existing.description
          : input.description.trim(),
        normalizeStatus(input.status, existing.status),
        input.visibilityOverride === undefined
          ? existing.visibility_override
          : normalizeVisibilityOverride(
              input.visibilityOverride,
              existing.visibility_override,
            ),
        new Date().toISOString(),
        input.id,
      ],
    );

    await client.query(
      `UPDATE design_system_versions
       SET schema_json = $1, tokens_json = $2, guidelines_markdown = $3,
           skill_markdown = $4, export_manifest_json = $5, updated_at = $6
       WHERE id = $7`,
      [
        optionalJsonText(input.schema, existing.content.schema_json),
        optionalJsonText(input.tokens, existing.content.tokens_json),
        input.guidelinesMarkdown === undefined
          ? existing.content.guidelines_markdown
          : input.guidelinesMarkdown,
        input.skillMarkdown === undefined
          ? existing.content.skill_markdown
          : input.skillMarkdown,
        optionalJsonText(
          input.exportManifest,
          existing.content.export_manifest_json,
        ),
        new Date().toISOString(),
        existing.content.id,
      ],
    );
  });

  const detail = await getDesignSystemDetail(input.id);
  if (!detail) throw new Error("Failed to load updated design system");
  return detail;
}

export async function createDesignSystemVersion(input: {
  source: DesignSystemDetail;
  title?: string;
  description?: string;
  version?: string;
  schema?: unknown;
  tokens?: unknown;
  guidelinesMarkdown?: string;
  skillMarkdown?: string;
  exportManifest?: unknown;
  copyAssets?: boolean;
}): Promise<DesignSystemDetail> {
  const source = input.source;
  const newVersion = input.version?.trim() || incrementVersion(source.version);

  const newId = await withTransaction(async (client) => {
    await client.query(
      `UPDATE design_systems SET is_active = FALSE, updated_at = $2
       WHERE family_root_id = $1 AND is_active = TRUE`,
      [source.family_root_id, new Date().toISOString()],
    );

    const designSystemId = await insertAndReturnId(
      `INSERT INTO design_systems (
         title, slug, description, version, parent_design_system_id,
         family_root_id, is_active, status, owner_id, folder_id,
         visibility_override
       ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10)`,
      [
        input.title?.trim() || source.title,
        source.slug,
        input.description === undefined
          ? source.description
          : input.description.trim(),
        newVersion,
        source.id,
        source.family_root_id,
        source.status,
        source.owner_id,
        source.folder_id,
        source.visibility_override,
      ],
      client,
    );

    const versionId = await insertAndReturnId(
      `INSERT INTO design_system_versions (
         design_system_id, schema_json, tokens_json, guidelines_markdown,
         skill_markdown, export_manifest_json
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        designSystemId,
        optionalJsonText(input.schema, source.content.schema_json),
        optionalJsonText(input.tokens, source.content.tokens_json),
        input.guidelinesMarkdown ?? source.content.guidelines_markdown,
        input.skillMarkdown ?? source.content.skill_markdown,
        optionalJsonText(
          input.exportManifest,
          source.content.export_manifest_json,
        ),
      ],
      client,
    );

    if (input.copyAssets !== false) {
      for (const asset of source.assets) {
        await client.query(
          `INSERT INTO design_system_assets (
             design_system_id, version_id, kind, filename, mime_type,
             content_text, content_base64, size_bytes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            designSystemId,
            versionId,
            asset.kind,
            asset.filename,
            asset.mime_type,
            asset.content_text,
            asset.content_base64,
            asset.size_bytes,
          ],
        );
      }
    }

    return designSystemId;
  });

  const detail = await getDesignSystemDetail(newId);
  if (!detail) throw new Error("Failed to load new design system version");
  return detail;
}

export async function addDesignSystemAsset(
  input: DesignSystemAssetInput,
): Promise<DesignSystemAsset> {
  const designSystem = await getDesignSystemDetail(input.designSystemId);
  if (!designSystem) throw new Error("design system not found");

  const { kind, sizeBytes } = validateAssetInput(input);
  const id = await insertAndReturnId(
    `INSERT INTO design_system_assets (
       design_system_id, version_id, kind, filename, mime_type,
       content_text, content_base64, size_bytes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      designSystem.id,
      designSystem.content.id,
      kind,
      input.filename.trim(),
      input.mimeType.trim(),
      input.contentText ?? null,
      input.contentBase64 ?? null,
      sizeBytes,
    ],
  );

  const row = await queryOne<DesignSystemAssetRow>(
    "SELECT * FROM design_system_assets WHERE id = $1",
    [id],
  );
  if (!row) throw new Error("Failed to load created asset");
  return normalizeDesignSystemAsset(row);
}

export function buildDesignSystemJsonExport(detail: DesignSystemDetail) {
  return {
    design_system: {
      id: detail.id,
      title: detail.title,
      slug: detail.slug,
      description: detail.description,
      version: detail.version,
      status: detail.status,
      family_root_id: detail.family_root_id,
    },
    schema: parseJsonObject(detail.content.schema_json),
    tokens: parseJsonObject(detail.content.tokens_json),
    guidelines_markdown: detail.content.guidelines_markdown,
    skill_markdown: detail.content.skill_markdown,
    export_manifest: parseJsonObject(detail.content.export_manifest_json),
    assets: detail.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      content_text: asset.content_text,
      content_base64: asset.content_base64,
    })),
  };
}

export function buildDesignSystemSkillExport(
  detail: DesignSystemDetail,
): string {
  const title = detail.title;
  const description =
    detail.description.trim() ||
    `Use the ${detail.title} design system from the BlueKiwi registry.`;
  const baseSkill = detail.content.skill_markdown.trim();
  const guidelines = detail.content.guidelines_markdown.trim();
  const tokens = JSON.stringify(parseJsonObject(detail.content.tokens_json), null, 2);
  const schema = JSON.stringify(parseJsonObject(detail.content.schema_json), null, 2);
  const assetList = detail.assets
    .map((asset) => `- ${asset.kind}: ${asset.filename} (${asset.mime_type})`)
    .join("\n");

  return `---\nname: ${detail.slug}\ndescription: ${yamlDoubleQuoted(description)}\n---\n\n# ${title}\n\n${baseSkill || "Use this design system when creating or editing user-facing visual materials."}\n\n## Guidelines\n\n${guidelines || "No additional guidelines have been recorded yet."}\n\n## Tokens\n\n\`\`\`json\n${tokens}\n\`\`\`\n\n## Schema\n\n\`\`\`json\n${schema}\n\`\`\`\n\n## Assets\n\n${assetList || "- No assets registered."}\n`;
}
