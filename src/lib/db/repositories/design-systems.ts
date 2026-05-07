import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import {
  execute,
  insertAndReturnId,
  query,
  queryOne,
  withTransaction,
} from "@/lib/db";
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

type DesignSystemComponentDoc = {
  name: string;
  framework:
    | "react"
    | "html"
    | "mixed"
    | "tokens"
    | "tailwind"
    | "shadcn";
  styleSystem: string;
  description: string;
  props: Array<Record<string, unknown>>;
  variants: string[];
  classes: string[];
  dependencies: string[];
  install: string[];
  tailwind: Record<string, unknown>;
  shadcn: Record<string, unknown>;
  html: string;
  css: string;
  react: string;
  usage: string;
  sourceAssets: string[];
  raw: Record<string, unknown>;
};

export interface DesignSystemCreateInput {
  title: string;
  slug?: string;
  description?: string;
  version?: string;
  status?: DesignSystemStatus;
  schema?: unknown;
  tokens?: unknown;
  colorTokens?: unknown;
  typographyTokens?: unknown;
  componentTokens?: unknown;
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
  colorTokens?: unknown;
  typographyTokens?: unknown;
  componentTokens?: unknown;
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
  const tokensJson =
    typeof row.tokens_json === "string"
      ? row.tokens_json
      : JSON.stringify(row.tokens_json ?? {});
  const tokenSections = deriveTokenSections(tokensJson);

  return {
    ...row,
    schema_json:
      typeof row.schema_json === "string"
        ? row.schema_json
        : JSON.stringify(row.schema_json ?? {}),
    tokens_json: tokensJson,
    color_tokens_json: normalizeSectionJson(
      row.color_tokens_json,
      tokenSections.color,
    ),
    typography_tokens_json: normalizeSectionJson(
      row.typography_tokens_json,
      tokenSections.typography,
    ),
    component_tokens_json: normalizeSectionJson(
      row.component_tokens_json,
      tokenSections.components,
    ),
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject<T = Record<string, unknown>>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

function normalizeSectionJson(
  value: unknown,
  fallback: Record<string, unknown>,
): string {
  const normalized =
    value === undefined || value === null || value === ""
      ? fallback
      : typeof value === "string"
        ? parseJsonObject(value)
        : value;
  if (!isPlainObject(normalized)) return JSON.stringify(fallback);
  return JSON.stringify(normalized);
}

function deriveTokenSections(tokensJson: string): {
  color: Record<string, unknown>;
  typography: Record<string, unknown>;
  components: Record<string, unknown>;
} {
  const tokens = parseJsonObject(tokensJson);
  return {
    color: isPlainObject(tokens.color) ? tokens.color : {},
    typography: isPlainObject(tokens.typography) ? tokens.typography : {},
    components: isPlainObject(tokens.components) ? tokens.components : {},
  };
}

function mergeTokenSections(input: {
  baseTokensJson?: string;
  baseColorTokensJson?: string;
  baseTypographyTokensJson?: string;
  baseComponentTokensJson?: string;
  tokens?: unknown;
  colorTokens?: unknown;
  typographyTokens?: unknown;
  componentTokens?: unknown;
}): {
  tokensJson: string;
  colorTokensJson: string;
  typographyTokensJson: string;
  componentTokensJson: string;
} {
  const baseTokens = input.baseTokensJson
    ? parseJsonObject(input.baseTokensJson)
    : {};
  const explicitTokens =
    input.tokens === undefined
      ? {}
      : typeof input.tokens === "string"
        ? parseJsonObject(input.tokens)
        : input.tokens;
  const explicitTokenObject = isPlainObject(explicitTokens)
    ? explicitTokens
    : {};
  const tokens = {
    ...baseTokens,
    ...explicitTokenObject,
  };
  const derived = deriveTokenSections(JSON.stringify(tokens));
  const baseDerived = input.baseTokensJson
    ? deriveTokenSections(input.baseTokensJson)
    : { color: {}, typography: {}, components: {} };
  const fallbackColor = input.baseColorTokensJson
    ? parseJsonObject(input.baseColorTokensJson)
    : baseDerived.color;
  const fallbackTypography = input.baseTypographyTokensJson
    ? parseJsonObject(input.baseTypographyTokensJson)
    : baseDerived.typography;
  const fallbackComponents = input.baseComponentTokensJson
    ? parseJsonObject(input.baseComponentTokensJson)
    : baseDerived.components;

  const color =
    input.colorTokens === undefined
      ? Object.hasOwn(explicitTokenObject, "color") || !input.baseTokensJson
        ? derived.color
        : fallbackColor
      : typeof input.colorTokens === "string"
        ? parseJsonObject(input.colorTokens)
        : input.colorTokens;
  const typography =
    input.typographyTokens === undefined
      ? Object.hasOwn(explicitTokenObject, "typography") ||
        !input.baseTokensJson
        ? derived.typography
        : fallbackTypography
      : typeof input.typographyTokens === "string"
        ? parseJsonObject(input.typographyTokens)
        : input.typographyTokens;
  const components =
    input.componentTokens === undefined
      ? Object.hasOwn(explicitTokenObject, "components") ||
        !input.baseTokensJson
        ? derived.components
        : fallbackComponents
      : typeof input.componentTokens === "string"
        ? parseJsonObject(input.componentTokens)
        : input.componentTokens;

  const normalizedColor = isPlainObject(color) ? color : {};
  const normalizedTypography = isPlainObject(typography) ? typography : {};
  const normalizedComponents = isPlainObject(components) ? components : {};
  const combined = {
    ...tokens,
    color: normalizedColor,
    typography: normalizedTypography,
    components: normalizedComponents,
  };

  return {
    tokensJson: JSON.stringify(combined),
    colorTokensJson: JSON.stringify(normalizedColor),
    typographyTokensJson: JSON.stringify(normalizedTypography),
    componentTokensJson: JSON.stringify(normalizedComponents),
  };
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
  const tokenPayload = mergeTokenSections({
    tokens: input.tokens,
    colorTokens: input.colorTokens,
    typographyTokens: input.typographyTokens,
    componentTokens: input.componentTokens,
  });

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
         design_system_id, schema_json, tokens_json, color_tokens_json,
         typography_tokens_json, component_tokens_json, guidelines_markdown,
         skill_markdown, export_manifest_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        jsonText(input.schema),
        tokenPayload.tokensJson,
        tokenPayload.colorTokensJson,
        tokenPayload.typographyTokensJson,
        tokenPayload.componentTokensJson,
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
  const tokenPayload = mergeTokenSections({
    baseTokensJson: existing.content.tokens_json,
    baseColorTokensJson: existing.content.color_tokens_json,
    baseTypographyTokensJson: existing.content.typography_tokens_json,
    baseComponentTokensJson: existing.content.component_tokens_json,
    tokens: input.tokens,
    colorTokens: input.colorTokens,
    typographyTokens: input.typographyTokens,
    componentTokens: input.componentTokens,
  });

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
       SET schema_json = $1, tokens_json = $2, color_tokens_json = $3,
           typography_tokens_json = $4, component_tokens_json = $5,
           guidelines_markdown = $6, skill_markdown = $7,
           export_manifest_json = $8, updated_at = $9
       WHERE id = $10`,
      [
        optionalJsonText(input.schema, existing.content.schema_json),
        tokenPayload.tokensJson,
        tokenPayload.colorTokensJson,
        tokenPayload.typographyTokensJson,
        tokenPayload.componentTokensJson,
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
  colorTokens?: unknown;
  typographyTokens?: unknown;
  componentTokens?: unknown;
  guidelinesMarkdown?: string;
  skillMarkdown?: string;
  exportManifest?: unknown;
  copyAssets?: boolean;
}): Promise<DesignSystemDetail> {
  const source = input.source;
  const newVersion = input.version?.trim() || incrementVersion(source.version);
  const tokenPayload = mergeTokenSections({
    baseTokensJson: source.content.tokens_json,
    baseColorTokensJson: source.content.color_tokens_json,
    baseTypographyTokensJson: source.content.typography_tokens_json,
    baseComponentTokensJson: source.content.component_tokens_json,
    tokens: input.tokens,
    colorTokens: input.colorTokens,
    typographyTokens: input.typographyTokens,
    componentTokens: input.componentTokens,
  });

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
         design_system_id, schema_json, tokens_json, color_tokens_json,
         typography_tokens_json, component_tokens_json, guidelines_markdown,
         skill_markdown, export_manifest_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        designSystemId,
        optionalJsonText(input.schema, source.content.schema_json),
        tokenPayload.tokensJson,
        tokenPayload.colorTokensJson,
        tokenPayload.typographyTokensJson,
        tokenPayload.componentTokensJson,
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

export async function findDesignSystemAsset(input: {
  designSystemId: number;
  assetId: number;
}): Promise<DesignSystemAsset | null> {
  const row = await queryOne<DesignSystemAssetRow>(
    "SELECT * FROM design_system_assets WHERE id = $1 AND design_system_id = $2",
    [input.assetId, input.designSystemId],
  );
  return row ? normalizeDesignSystemAsset(row) : null;
}

export async function deleteDesignSystemAsset(input: {
  designSystemId: number;
  assetId: number;
}): Promise<void> {
  const asset = await findDesignSystemAsset(input);
  if (!asset) throw new Error("design system asset not found");
  await execute(
    "DELETE FROM design_system_assets WHERE id = $1 AND design_system_id = $2",
    [input.assetId, input.designSystemId],
  );
}

export function buildDesignSystemJsonExport(detail: DesignSystemDetail) {
  const colorTokens = parseJsonObject(detail.content.color_tokens_json);
  const typographyTokens = parseJsonObject(detail.content.typography_tokens_json);
  const componentTokens = parseJsonObject(detail.content.component_tokens_json);
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
    token_sections: {
      color: colorTokens,
      typography: typographyTokens,
      components: componentTokens,
    },
    component_documents: buildDesignSystemComponentDocs(detail),
    guidelines_markdown: detail.content.guidelines_markdown,
    skill_markdown: detail.content.skill_markdown,
    design_markdown: buildDesignSystemDesignMarkdownExport(detail),
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

function markdownTable(
  rows: Array<[string, string]>,
  emptyMessage: string,
): string {
  if (rows.length === 0) return emptyMessage;
  return [
    "| Token | Value |",
    "| --- | --- |",
    ...rows.map(([name, value]) => `| \`${name}\` | ${value} |`),
  ].join("\n");
}

function flattenTokenRows(
  value: Record<string, unknown>,
  prefix = "",
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(item)) {
      rows.push(...flattenTokenRows(item, name));
    } else {
      rows.push([name, `\`${String(item)}\``]);
    }
  }
  return rows;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function stringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function propsValue(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject);
}

function resolveComponentFramework(
  spec: Record<string, unknown>,
): DesignSystemComponentDoc["framework"] {
  const framework = stringValue(spec.framework).toLowerCase();
  if (
    framework === "react" ||
    framework === "html" ||
    framework === "mixed" ||
    framework === "tailwind" ||
    framework === "shadcn" ||
    framework === "shadcn-ui"
  ) {
    if (framework === "shadcn-ui") return "shadcn";
    return framework;
  }
  if (isPlainObject(spec.shadcn) || isPlainObject(spec.shadcn_ui)) {
    return "shadcn";
  }
  if (
    isPlainObject(spec.tailwind) ||
    stringValue(spec.className) ||
    stringValue(spec.class_name) ||
    Array.isArray(spec.classes)
  ) {
    return "tailwind";
  }
  if (stringValue(spec.react) || stringValue(recordValue(spec.source).react)) {
    return "react";
  }
  if (
    stringValue(spec.html) ||
    stringValue(recordValue(spec.preview).html) ||
    stringValue(recordValue(spec.source).html)
  ) {
    return "html";
  }
  return "tokens";
}

export function buildDesignSystemComponentDocs(
  detail: DesignSystemDetail,
): DesignSystemComponentDoc[] {
  const components = parseJsonObject(detail.content.component_tokens_json);
  return Object.entries(components).map(([name, value]) => {
    const spec = recordValue(value);
    const preview = recordValue(spec.preview);
    const source = recordValue(spec.source);
    const tailwind = recordValue(spec.tailwind);
    const shadcn = {
      ...recordValue(spec.shadcn),
      ...recordValue(spec.shadcn_ui),
    };
    return {
      name,
      framework: resolveComponentFramework(spec),
      styleSystem:
        stringValue(spec.style_system) ||
        stringValue(spec.styleSystem) ||
        (isPlainObject(spec.shadcn) || isPlainObject(spec.shadcn_ui)
          ? "shadcn/ui + Tailwind CSS"
          : isPlainObject(spec.tailwind)
            ? "Tailwind CSS"
            : ""),
      description: stringValue(spec.description),
      props: propsValue(spec.props),
      variants: stringArrayValue(spec.variants),
      classes: [
        ...stringArrayValue(spec.classes),
        ...stringArrayValue(tailwind.classes),
        ...stringArrayValue(spec.className),
        ...stringArrayValue(spec.class_name),
      ],
      dependencies: [
        ...stringArrayValue(spec.dependencies),
        ...stringArrayValue(shadcn.dependencies),
        ...stringArrayValue(tailwind.plugins),
      ],
      install: [
        ...stringArrayValue(spec.install),
        ...stringArrayValue(spec.install_commands),
        ...stringArrayValue(spec.installCommands),
        ...stringArrayValue(shadcn.install),
        ...stringArrayValue(shadcn.install_commands),
      ],
      tailwind,
      shadcn,
      html:
        stringValue(preview.html) ||
        stringValue(spec.html) ||
        stringValue(source.html),
      css:
        stringValue(preview.css) ||
        stringValue(spec.css) ||
        stringValue(source.css),
      react: stringValue(spec.react) || stringValue(source.react),
      usage: stringValue(spec.usage) || stringValue(spec.guidelines),
      sourceAssets: stringArrayValue(spec.assets),
      raw: spec,
    };
  });
}

function componentDocsMarkdown(docs: DesignSystemComponentDoc[]): string {
  if (docs.length === 0) return "No component documents recorded.";

  return docs
    .map((doc) => {
      const props =
        doc.props.length > 0
          ? [
              "| Prop | Type | Default | Description |",
              "| --- | --- | --- | --- |",
              ...doc.props.map((prop) => {
                const name = stringValue(prop.name) || "-";
                const type = stringValue(prop.type) || "-";
                const defaultValue =
                  prop.default === undefined ? "-" : String(prop.default);
                const description = stringValue(prop.description) || "-";
                return `| \`${name}\` | \`${type}\` | \`${defaultValue}\` | ${description} |`;
              }),
            ].join("\n")
          : "No props documented.";
      const variants =
        doc.variants.length > 0
          ? doc.variants.map((variant) => `- \`${variant}\``).join("\n")
          : "- No variants documented.";
      const assets =
        doc.sourceAssets.length > 0
          ? doc.sourceAssets.map((asset) => `- \`${asset}\``).join("\n")
          : "- No component-specific assets linked.";
      const classes =
        doc.classes.length > 0
          ? doc.classes.map((item) => `- \`${item}\``).join("\n")
          : "- No Tailwind classes documented.";
      const dependencies =
        doc.dependencies.length > 0
          ? doc.dependencies.map((item) => `- \`${item}\``).join("\n")
          : "- No dependencies documented.";
      const install =
        doc.install.length > 0
          ? doc.install.map((item) => `- \`${item}\``).join("\n")
          : "- No install commands documented.";
      const codeBlocks = [
        doc.react
          ? `\n#### React\n\n\`\`\`tsx\n${doc.react}\n\`\`\``
          : "",
        doc.html ? `\n#### HTML\n\n\`\`\`html\n${doc.html}\n\`\`\`` : "",
        doc.css ? `\n#### CSS\n\n\`\`\`css\n${doc.css}\n\`\`\`` : "",
        Object.keys(doc.tailwind).length > 0
          ? `\n#### Tailwind\n\n\`\`\`json\n${JSON.stringify(doc.tailwind, null, 2)}\n\`\`\``
          : "",
        Object.keys(doc.shadcn).length > 0
          ? `\n#### shadcn/ui\n\n\`\`\`json\n${JSON.stringify(doc.shadcn, null, 2)}\n\`\`\``
          : "",
      ].join("");

      return `### ${doc.name}

- Framework: \`${doc.framework}\`
- Style system: ${doc.styleSystem || "Not specified."}
- Description: ${doc.description || "No description recorded."}

#### Props

${props}

#### Variants

${variants}

#### Usage

${doc.usage || "No usage guidance recorded."}

#### Tailwind Classes

${classes}

#### Dependencies

${dependencies}

#### Install

${install}

#### Source Assets

${assets}${codeBlocks}`;
    })
    .join("\n\n");
}

export function buildDesignSystemDesignMarkdownExport(
  detail: DesignSystemDetail,
): string {
  const schema = parseJsonObject(detail.content.schema_json);
  const colors = parseJsonObject(detail.content.color_tokens_json);
  const typography = parseJsonObject(detail.content.typography_tokens_json);
  const components = parseJsonObject(detail.content.component_tokens_json);
  const componentDocs = buildDesignSystemComponentDocs(detail);
  const guidelines = detail.content.guidelines_markdown.trim();
  const assets = detail.assets
    .map(
      (asset) =>
        `- ${asset.kind}: \`${asset.filename}\` (${asset.mime_type}, ${asset.size_bytes} bytes)`,
    )
    .join("\n");

  return `# ${detail.title} DESIGN.md

## Identity

- Slug: \`${detail.slug}\`
- Version: \`${detail.version}\`
- Status: \`${detail.status}\`
- Description: ${detail.description || "No description recorded."}

## Usage

${detail.content.skill_markdown.trim() || "Use this design system when creating or editing user-facing visual materials."}

## Schema

\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

## Color Palette

${markdownTable(flattenTokenRows(colors), "No color tokens recorded.")}

## Typography

${markdownTable(flattenTokenRows(typography), "No typography tokens recorded.")}

## Components

${markdownTable(flattenTokenRows(components), "No component tokens recorded.")}

## Component Documents

${componentDocsMarkdown(componentDocs)}

## Guidelines

${guidelines || "No additional guidelines have been recorded yet."}

## Assets

${assets || "- No assets registered."}
`;
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
  const designMarkdown = buildDesignSystemDesignMarkdownExport(detail);
  const assetList = detail.assets
    .map((asset) => `- ${asset.kind}: ${asset.filename} (${asset.mime_type})`)
    .join("\n");

  return `---\nname: ${detail.slug}\ndescription: ${yamlDoubleQuoted(description)}\n---\n\n# ${title}\n\n${baseSkill || "Use this design system when creating or editing user-facing visual materials."}\n\n## Guidelines\n\n${guidelines || "No additional guidelines have been recorded yet."}\n\n## DESIGN.md\n\n${designMarkdown}\n\n## Tokens\n\n\`\`\`json\n${tokens}\n\`\`\`\n\n## Schema\n\n\`\`\`json\n${schema}\n\`\`\`\n\n## Assets\n\n${assetList || "- No assets registered."}\n`;
}
