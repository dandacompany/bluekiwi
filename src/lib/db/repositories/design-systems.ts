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
const SUPPORTED_SURFACES = ["web", "image", "video", "audio", "slides", "docs"];
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

export interface DesignSystemEvent {
  id: number;
  design_system_id: number;
  actor_user_id: number | null;
  action: string;
  summary: string;
  metadata_json: string;
  created_at: string;
}

interface DesignSystemEventRow
  extends Omit<DesignSystemEvent, "metadata_json" | "created_at"> {
  metadata_json: string | Record<string, unknown>;
  created_at: string | Date;
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
  states: string[];
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

export type DesignSystemLintSeverity = "error" | "warning" | "info";

export interface DesignSystemLintIssue {
  severity: DesignSystemLintSeverity;
  code: string;
  target: string;
  message: string;
  suggestion?: string;
}

export interface DesignSystemLintResult {
  ok: boolean;
  score: number;
  issue_counts: Record<DesignSystemLintSeverity, number>;
  issues: DesignSystemLintIssue[];
}

export interface ParsedDesignSystemPackage {
  title: string;
  slug?: string;
  description: string;
  version?: string;
  category?: string;
  surface?: string;
  schema: unknown;
  tokens: unknown;
  colorTokens: unknown;
  typographyTokens: unknown;
  componentTokens: unknown;
  guidelinesMarkdown: string;
  skillMarkdown: string;
  exportManifest: unknown;
  assets: Array<{
    kind: DesignSystemAssetKind;
    filename: string;
    mimeType: string;
    contentText: string;
  }>;
}

export interface DesignSystemPackageAnalysis {
  summary: {
    title: string;
    slug: string | null;
    description: string;
    version: string;
    category: string;
    surface: string;
  };
  counts: {
    colors: number;
    typography: number;
    components: number;
    assets: number;
    guidelines_chars: number;
    skill_chars: number;
  };
  related_systems: Array<{
    id: number;
    title: string;
    slug: string;
    version: string;
    category: string;
    surface: string;
    status: string;
    is_active: boolean;
    score: number;
    reasons: string[];
  }>;
  recommended_mode: "create" | "version";
  suggested_target_design_system_id: number | null;
}

export interface DesignSystemVersionDiffSection {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface DesignSystemVersionDiff {
  from: Pick<
    DesignSystem,
    "id" | "title" | "slug" | "version" | "is_active" | "updated_at"
  >;
  to: Pick<
    DesignSystem,
    "id" | "title" | "slug" | "version" | "is_active" | "updated_at"
  >;
  metadata: DesignSystemVersionDiffSection;
  sections: Record<
    "schema" | "tokens" | "colors" | "typography" | "components",
    DesignSystemVersionDiffSection
  >;
  markdown: {
    guidelines_changed: boolean;
    skill_changed: boolean;
  };
  assets: DesignSystemVersionDiffSection;
}

export interface DesignSystemCreateInput {
  title: string;
  slug?: string;
  description?: string;
  version?: string;
  category?: string;
  surface?: string;
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
  category?: string;
  surface?: string;
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

export type DesignSystemSection =
  | "schema"
  | "tokens"
  | "colors"
  | "typography"
  | "components"
  | "guidelines"
  | "skill"
  | "assets";

export type DesignSystemSectionUpdateMode = "replace" | "merge";

const DESIGN_SYSTEM_SECTION_ALIASES: Record<string, DesignSystemSection> = {
  schema: "schema",
  tokens: "tokens",
  color: "colors",
  colors: "colors",
  palette: "colors",
  palettes: "colors",
  typography: "typography",
  font: "typography",
  fonts: "typography",
  components: "components",
  component: "components",
  guidelines: "guidelines",
  guideline: "guidelines",
  skill: "skill",
  assets: "assets",
};

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

function normalizeDesignSystemEvent(row: DesignSystemEventRow): DesignSystemEvent {
  return {
    ...row,
    metadata_json:
      typeof row.metadata_json === "string"
        ? row.metadata_json
        : JSON.stringify(row.metadata_json ?? {}),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
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

function parseJsonValue(value: string, fallback: unknown = {}) {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function diffRecordKeys(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
): DesignSystemVersionDiffSection {
  const fromKeys = new Set(Object.keys(from));
  const toKeys = new Set(Object.keys(to));
  const added = [...toKeys].filter((key) => !fromKeys.has(key)).sort();
  const removed = [...fromKeys].filter((key) => !toKeys.has(key)).sort();
  const changed = [...toKeys]
    .filter(
      (key) =>
        fromKeys.has(key) && stableJson(from[key]) !== stableJson(to[key]),
    )
    .sort();
  return { added, removed, changed };
}

export function normalizeDesignSystemSection(
  value: string,
): DesignSystemSection {
  const section = DESIGN_SYSTEM_SECTION_ALIASES[value.trim().toLowerCase()];
  if (!section) {
    throw new Error(
      "section must be schema, tokens, colors, typography, components, guidelines, skill, or assets",
    );
  }
  return section;
}

function normalizeSectionUpdateMode(
  value: unknown,
): DesignSystemSectionUpdateMode {
  if (value === undefined || value === null || value === "") return "replace";
  if (value === "replace" || value === "merge") return value;
  throw new Error("mode must be replace or merge");
}

function ensureObjectSectionValue(
  section: DesignSystemSection,
  value: unknown,
): Record<string, unknown> {
  const parsed =
    typeof value === "string" && value.trim() ? parseJsonObject(value) : value;
  if (!isPlainObject(parsed)) {
    throw new Error(`${section} section value must be a JSON object`);
  }
  return parsed;
}

function ensureStringSectionValue(
  section: DesignSystemSection,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new Error(`${section} section value must be a string`);
  }
  return value;
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

function applySplitTokenSection(input: {
  tokensJson: string;
  section: "colors" | "typography" | "components";
  value: Record<string, unknown>;
}): string {
  const tokens = parseJsonObject(input.tokensJson);
  const key =
    input.section === "colors"
      ? "color"
      : input.section === "typography"
        ? "typography"
        : "components";
  return JSON.stringify({ ...tokens, [key]: input.value });
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

function normalizeCategory(value: unknown, fallback = "Custom"): string {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeSurface(value: unknown, fallback = "web"): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" && SUPPORTED_SURFACES.includes(value)) {
    return value;
  }
  throw new Error("surface must be web, image, video, audio, slides, or docs");
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

export async function recordDesignSystemEvent(input: {
  designSystemId: number;
  actorUserId?: number | null;
  action: string;
  summary?: string;
  metadata?: unknown;
}): Promise<DesignSystemEvent> {
  const id = await insertAndReturnId(
    `INSERT INTO design_system_events (
       design_system_id, actor_user_id, action, summary, metadata_json
     ) VALUES ($1, $2, $3, $4, $5)`,
    [
      input.designSystemId,
      input.actorUserId ?? null,
      input.action.trim(),
      input.summary?.trim() ?? "",
      jsonText(input.metadata),
    ],
  );
  const row = await queryOne<DesignSystemEventRow>(
    "SELECT * FROM design_system_events WHERE id = $1",
    [id],
  );
  if (!row) throw new Error("Failed to load created design-system event");
  return normalizeDesignSystemEvent(row);
}

export async function listDesignSystemEvents(input: {
  designSystemId: number;
  limit?: number;
}): Promise<DesignSystemEvent[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const rows = await query<DesignSystemEventRow>(
    `SELECT * FROM design_system_events
     WHERE design_system_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [input.designSystemId, limit],
  );
  return rows.map(normalizeDesignSystemEvent);
}

export async function listDesignSystemsForVisibilityFilter(input: {
  filterSql: string;
  filterParams: unknown[];
  includeInactive?: boolean;
  folderId?: number;
  q?: string;
  category?: string;
  surface?: string;
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
      `(LOWER(ds.title) LIKE LOWER($${params.length}) OR LOWER(ds.slug) LIKE LOWER($${params.length}) OR LOWER(ds.category) LIKE LOWER($${params.length}))`,
    );
  }
  if (input.category) {
    params.push(input.category);
    clauses.push(`LOWER(ds.category) = LOWER($${params.length})`);
  }
  if (input.surface) {
    params.push(input.surface);
    clauses.push(`ds.surface = $${params.length}`);
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

export async function activateDesignSystemVersion(
  target: DesignSystem,
): Promise<DesignSystem> {
  const rootId = target.family_root_id ?? target.id;
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE design_systems SET is_active = FALSE, updated_at = $2
       WHERE (family_root_id = $1 OR id = $1) AND is_active = TRUE`,
      [rootId, new Date().toISOString()],
    );
    await client.query(
      "UPDATE design_systems SET is_active = TRUE, updated_at = $2 WHERE id = $1",
      [target.id, new Date().toISOString()],
    );
    const result = await client.query<DesignSystemRow>(
      "SELECT * FROM design_systems WHERE id = $1",
      [target.id],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Failed to load activated design system");
    return normalizeDesignSystem(row);
  });
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

export async function listDesignSystemFamilyVersions(
  id: number,
): Promise<DesignSystem[]> {
  const existing = await findDesignSystemById(id);
  if (!existing) return [];
  const rootId = existing.family_root_id ?? existing.id;
  const rows = await query<DesignSystemRow>(
    `SELECT * FROM design_systems
     WHERE family_root_id = $1 OR id = $1
     ORDER BY created_at DESC, id DESC`,
    [rootId],
  );
  return rows.map(normalizeDesignSystem);
}

function diffMetadata(
  from: DesignSystemDetail,
  to: DesignSystemDetail,
): DesignSystemVersionDiffSection {
  return diffRecordKeys(
    {
      title: from.title,
      slug: from.slug,
      description: from.description,
      version: from.version,
      category: from.category,
      surface: from.surface,
      status: from.status,
      visibility_override: from.visibility_override,
    },
    {
      title: to.title,
      slug: to.slug,
      description: to.description,
      version: to.version,
      category: to.category,
      surface: to.surface,
      status: to.status,
      visibility_override: to.visibility_override,
    },
  );
}

function diffAssetKeys(
  from: DesignSystemDetail,
  to: DesignSystemDetail,
): DesignSystemVersionDiffSection {
  const toKey = (asset: DesignSystemAsset) => asset.filename;
  const fromAssets = Object.fromEntries(
    from.assets.map((asset) => [
      toKey(asset),
      {
        kind: asset.kind,
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes,
        content_text: asset.content_text,
        content_base64: asset.content_base64,
      },
    ]),
  );
  const toAssets = Object.fromEntries(
    to.assets.map((asset) => [
      toKey(asset),
      {
        kind: asset.kind,
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes,
        content_text: asset.content_text,
        content_base64: asset.content_base64,
      },
    ]),
  );
  return diffRecordKeys(fromAssets, toAssets);
}

export function buildDesignSystemVersionDiff(
  from: DesignSystemDetail,
  to: DesignSystemDetail,
): DesignSystemVersionDiff {
  return {
    from: {
      id: from.id,
      title: from.title,
      slug: from.slug,
      version: from.version,
      is_active: from.is_active,
      updated_at: from.updated_at,
    },
    to: {
      id: to.id,
      title: to.title,
      slug: to.slug,
      version: to.version,
      is_active: to.is_active,
      updated_at: to.updated_at,
    },
    metadata: diffMetadata(from, to),
    sections: {
      schema: diffRecordKeys(
        parseJsonObject(from.content.schema_json),
        parseJsonObject(to.content.schema_json),
      ),
      tokens: diffRecordKeys(
        parseJsonObject(from.content.tokens_json),
        parseJsonObject(to.content.tokens_json),
      ),
      colors: diffRecordKeys(
        parseJsonObject(from.content.color_tokens_json),
        parseJsonObject(to.content.color_tokens_json),
      ),
      typography: diffRecordKeys(
        parseJsonObject(from.content.typography_tokens_json),
        parseJsonObject(to.content.typography_tokens_json),
      ),
      components: diffRecordKeys(
        parseJsonObject(from.content.component_tokens_json),
        parseJsonObject(to.content.component_tokens_json),
      ),
    },
    markdown: {
      guidelines_changed:
        from.content.guidelines_markdown !== to.content.guidelines_markdown,
      skill_changed: from.content.skill_markdown !== to.content.skill_markdown,
    },
    assets: diffAssetKeys(from, to),
  };
}

export function getDesignSystemSectionValue(
  detail: DesignSystemDetail,
  sectionInput: string,
): unknown {
  const section = normalizeDesignSystemSection(sectionInput);
  if (section === "schema") return parseJsonObject(detail.content.schema_json);
  if (section === "tokens") return parseJsonObject(detail.content.tokens_json);
  if (section === "colors") {
    return parseJsonObject(detail.content.color_tokens_json);
  }
  if (section === "typography") {
    return parseJsonObject(detail.content.typography_tokens_json);
  }
  if (section === "components") {
    return parseJsonObject(detail.content.component_tokens_json);
  }
  if (section === "guidelines") return detail.content.guidelines_markdown;
  if (section === "skill") return detail.content.skill_markdown;
  return detail.assets;
}

function getObjectSectionValue(
  detail: DesignSystemDetail,
  section: DesignSystemSection,
): Record<string, unknown> {
  const value = getDesignSystemSectionValue(detail, section);
  if (!isPlainObject(value)) {
    throw new Error(`${section} section does not support keyed entries`);
  }
  return value;
}

export function getDesignSystemSectionEntryValue(
  detail: DesignSystemDetail,
  sectionInput: string,
  key: string,
): unknown | null {
  const section = normalizeDesignSystemSection(sectionInput);
  const value = getObjectSectionValue(detail, section);
  return Object.hasOwn(value, key) ? value[key] : null;
}

export function getDesignSystemComponentValue(
  detail: DesignSystemDetail,
  name: string,
): { name: string; value: unknown; document: DesignSystemComponentDoc | null } | null {
  const value = getDesignSystemSectionEntryValue(detail, "components", name);
  if (value === null) return null;
  const document =
    buildDesignSystemComponentDocs(detail).find((doc) => doc.name === name) ??
    null;
  return { name, value, document };
}

export async function deleteDesignSystem(input: {
  id: number;
  family?: boolean;
}): Promise<void> {
  const existing = await findDesignSystemById(input.id);
  if (!existing) throw new Error("design system not found");
  if (input.family) {
    const rootId = existing.family_root_id ?? existing.id;
    await execute(
      `DELETE FROM design_systems
       WHERE id IN (
         SELECT id FROM design_systems WHERE id = $1 OR family_root_id = $1
       )`,
      [rootId],
    );
    return;
  }
  await execute("DELETE FROM design_systems WHERE id = $1", [input.id]);
}

export async function updateDesignSystemSection(input: {
  id: number;
  section: string;
  value: unknown;
  mode?: unknown;
}): Promise<DesignSystemDetail> {
  const existing = await getDesignSystemDetail(input.id);
  if (!existing) throw new Error("design system not found");

  const section = normalizeDesignSystemSection(input.section);
  const mode = normalizeSectionUpdateMode(input.mode);
  const now = new Date().toISOString();

  if (section === "assets") {
    throw new Error("assets section cannot be replaced; use asset endpoints");
  }

  let schemaJson = existing.content.schema_json;
  let tokensJson = existing.content.tokens_json;
  let colorTokensJson = existing.content.color_tokens_json;
  let typographyTokensJson = existing.content.typography_tokens_json;
  let componentTokensJson = existing.content.component_tokens_json;
  let guidelinesMarkdown = existing.content.guidelines_markdown;
  let skillMarkdown = existing.content.skill_markdown;

  if (section === "guidelines") {
    guidelinesMarkdown = ensureStringSectionValue(section, input.value);
  } else if (section === "skill") {
    skillMarkdown = ensureStringSectionValue(section, input.value);
  } else if (section === "schema") {
    const value = ensureObjectSectionValue(section, input.value);
    const current = parseJsonObject(existing.content.schema_json);
    schemaJson = JSON.stringify(mode === "merge" ? { ...current, ...value } : value);
  } else if (section === "tokens") {
    const value = ensureObjectSectionValue(section, input.value);
    const current = parseJsonObject(existing.content.tokens_json);
    const tokens = mode === "merge" ? { ...current, ...value } : value;
    const split = deriveTokenSections(JSON.stringify(tokens));
    tokensJson = JSON.stringify(tokens);
    colorTokensJson = JSON.stringify(split.color);
    typographyTokensJson = JSON.stringify(split.typography);
    componentTokensJson = JSON.stringify(split.components);
  } else {
    const value = ensureObjectSectionValue(section, input.value);
    const current = getObjectSectionValue(existing, section);
    const next = mode === "merge" ? { ...current, ...value } : value;
    if (section === "colors") {
      colorTokensJson = JSON.stringify(next);
      tokensJson = applySplitTokenSection({
        tokensJson,
        section,
        value: next,
      });
    } else if (section === "typography") {
      typographyTokensJson = JSON.stringify(next);
      tokensJson = applySplitTokenSection({
        tokensJson,
        section,
        value: next,
      });
    } else if (section === "components") {
      componentTokensJson = JSON.stringify(next);
      tokensJson = applySplitTokenSection({
        tokensJson,
        section,
        value: next,
      });
    }
  }

  await withTransaction(async (client) => {
    await client.query(
      "UPDATE design_systems SET updated_at = $1 WHERE id = $2",
      [now, input.id],
    );
    await client.query(
      `UPDATE design_system_versions
       SET schema_json = $1, tokens_json = $2, color_tokens_json = $3,
           typography_tokens_json = $4, component_tokens_json = $5,
           guidelines_markdown = $6, skill_markdown = $7, updated_at = $8
       WHERE id = $9`,
      [
        schemaJson,
        tokensJson,
        colorTokensJson,
        typographyTokensJson,
        componentTokensJson,
        guidelinesMarkdown,
        skillMarkdown,
        now,
        existing.content.id,
      ],
    );
  });

  const detail = await getDesignSystemDetail(input.id);
  if (!detail) throw new Error("Failed to load updated design system");
  return detail;
}

export async function clearDesignSystemSection(input: {
  id: number;
  section: string;
}): Promise<DesignSystemDetail> {
  const section = normalizeDesignSystemSection(input.section);
  if (section === "assets") {
    throw new Error("assets section cannot be cleared; use asset endpoints");
  }
  const value = section === "guidelines" || section === "skill" ? "" : {};
  return updateDesignSystemSection({
    id: input.id,
    section,
    value,
    mode: "replace",
  });
}

export async function upsertDesignSystemSectionEntry(input: {
  id: number;
  section: string;
  key: string;
  value: unknown;
}): Promise<DesignSystemDetail> {
  const key = input.key.trim();
  if (!key) throw new Error("entry key is required");
  const existing = await getDesignSystemDetail(input.id);
  if (!existing) throw new Error("design system not found");
  const section = normalizeDesignSystemSection(input.section);
  const sectionValue = getObjectSectionValue(existing, section);
  return updateDesignSystemSection({
    id: input.id,
    section,
    value: { ...sectionValue, [key]: input.value },
    mode: "replace",
  });
}

export async function deleteDesignSystemSectionEntry(input: {
  id: number;
  section: string;
  key: string;
}): Promise<DesignSystemDetail> {
  const existing = await getDesignSystemDetail(input.id);
  if (!existing) throw new Error("design system not found");
  const section = normalizeDesignSystemSection(input.section);
  const sectionValue = { ...getObjectSectionValue(existing, section) };
  delete sectionValue[input.key];
  return updateDesignSystemSection({
    id: input.id,
    section,
    value: sectionValue,
    mode: "replace",
  });
}

export async function upsertDesignSystemComponent(input: {
  id: number;
  name: string;
  value: unknown;
}): Promise<DesignSystemDetail> {
  return upsertDesignSystemSectionEntry({
    id: input.id,
    section: "components",
    key: input.name,
    value: input.value,
  });
}

export async function deleteDesignSystemComponent(input: {
  id: number;
  name: string;
}): Promise<DesignSystemDetail> {
  return deleteDesignSystemSectionEntry({
    id: input.id,
    section: "components",
    key: input.name,
  });
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
         title, slug, description, version, category, surface, status, owner_id,
         folder_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        title,
        slug,
        input.description?.trim() ?? "",
        input.version?.trim() || "1.0",
        normalizeCategory(input.category),
        normalizeSurface(input.surface),
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
       SET title = $1, slug = $2, description = $3, category = $4,
           surface = $5, status = $6, visibility_override = $7, updated_at = $8
       WHERE id = $9`,
      [
        title,
        slug,
        input.description === undefined
          ? existing.description
          : input.description.trim(),
        normalizeCategory(input.category, existing.category),
        normalizeSurface(input.surface, existing.surface),
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
         title, slug, description, version, category, surface,
         parent_design_system_id, family_root_id, is_active, status, owner_id,
         folder_id, visibility_override
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11, $12)`,
      [
        input.title?.trim() || source.title,
        source.slug,
        input.description === undefined
          ? source.description
          : input.description.trim(),
        newVersion,
        source.category,
        source.surface,
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
      category: detail.category,
      surface: detail.surface,
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

function markdownValue(value: unknown): string {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function safeCssToken(value: string, fallback: string): string {
  return /^[#(),.%\w\s-]+$/.test(value) ? value : fallback;
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

function stateArrayValue(value: unknown): string[] {
  const normalize = (item: string) =>
    item.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => typeof item === "string" ? normalize(item) : "").filter(Boolean))];
  }
  if (typeof value === "string" && value.trim()) return [normalize(value)];
  if (isPlainObject(value)) {
    return Object.keys(value).map(normalize).filter(Boolean);
  }
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
      states: [
        ...stateArrayValue(spec.states),
        ...stateArrayValue(spec.state),
        ...stateArrayValue(spec.interaction_states),
      ],
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
      const states =
        doc.states.length > 0
          ? doc.states.map((state) => `- \`${state}\``).join("\n")
          : "- No states documented.";
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

#### States

${states}

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

function componentInventoryMarkdown(docs: DesignSystemComponentDoc[]): string {
  if (docs.length === 0) return "No component inventory recorded.";

  return [
    "| Component | Framework | States | Variants | Source |",
    "| --- | --- | --- | --- | --- |",
    ...docs.map((doc) => {
      const source = [
        doc.react ? "React" : "",
        doc.html ? "HTML" : "",
        doc.css ? "CSS" : "",
        Object.keys(doc.tailwind).length > 0 ? "Tailwind" : "",
        Object.keys(doc.shadcn).length > 0 ? "shadcn/ui" : "",
      ].filter(Boolean);
      return [
        `\`${doc.name}\``,
        `\`${doc.framework}\``,
        doc.states.length,
        doc.variants.length,
        source.length > 0 ? source.join(", ") : "Tokens",
      ].join(" | ");
    }).map((row) => `| ${row} |`),
  ].join("\n");
}

function componentCatalogMarkdown(docs: DesignSystemComponentDoc[]): string {
  if (docs.length === 0) return "No component catalog entries recorded.";

  return [
    "| Component | Framework | Style System | States | Variants | Source |",
    "| --- | --- | --- | --- | --- | --- |",
    ...docs.map((doc) => {
      const source = [
        doc.react ? "React" : "",
        doc.html ? "HTML" : "",
        doc.css ? "CSS" : "",
        Object.keys(doc.tailwind).length > 0 ? "Tailwind" : "",
        Object.keys(doc.shadcn).length > 0 ? "shadcn/ui" : "",
      ].filter(Boolean);
      return [
        `\`${doc.name}\``,
        `\`${doc.framework}\``,
        markdownValue(doc.styleSystem || "Not specified"),
        doc.states.length > 0
          ? doc.states.map((state) => `\`${state}\``).join(", ")
          : "None",
        doc.variants.length > 0
          ? doc.variants.map((variant) => `\`${variant}\``).join(", ")
          : "None",
        source.length > 0 ? source.join(", ") : "Tokens only",
      ].join(" | ");
    }).map((row) => `| ${row} |`),
  ].join("\n");
}

function lintSummaryMarkdown(result: DesignSystemLintResult): string {
  const issues = result.issues.slice(0, 12);
  const issueList =
    issues.length > 0
      ? issues
          .map((issue) => {
            const suggestion = issue.suggestion
              ? ` Suggestion: ${issue.suggestion}`
              : "";
            return `- ${issue.severity.toUpperCase()} \`${issue.code}\` at \`${issue.target}\`: ${issue.message}${suggestion}`;
          })
          .join("\n")
      : "- No lint issues detected.";
  const remaining =
    result.issues.length > issues.length
      ? `\n- ${result.issues.length - issues.length} additional issue(s) omitted from this summary.`
      : "";

  return `- OK: \`${result.ok}\`
- Score: \`${result.score}\`
- Issue counts: error \`${result.issue_counts.error}\`, warning \`${result.issue_counts.warning}\`, info \`${result.issue_counts.info}\`

${issueList}${remaining}`;
}

function addIssue(
  issues: DesignSystemLintIssue[],
  issue: DesignSystemLintIssue,
): void {
  issues.push(issue);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number | null {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return null;
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function findTokenByHints(
  tokens: Record<string, unknown>,
  hints: RegExp[],
): string | null {
  const rows = flattenTokenRows(tokens);
  for (const [name, value] of rows) {
    const raw = value.replaceAll("`", "");
    if (hexToRgb(raw) && hints.some((hint) => hint.test(name))) return raw;
  }
  return null;
}

function missingStates(component: DesignSystemComponentDoc): string[] {
  const required = ["default", "hover", "focus-visible", "disabled"];
  const name = component.name.toLowerCase();
  if (/button|submit|cta/.test(name)) required.push("loading");
  if (/input|select|textarea|checkbox|radio|switch|slider|field/.test(name)) {
    required.push("error");
  }
  return [...new Set(required)].filter(
    (state) => !component.states.includes(state),
  );
}

export function lintDesignSystem(detail: DesignSystemDetail): DesignSystemLintResult {
  const issues: DesignSystemLintIssue[] = [];
  const colors = parseJsonObject(detail.content.color_tokens_json);
  const typography = parseJsonObject(detail.content.typography_tokens_json);
  const components = buildDesignSystemComponentDocs(detail);
  const guidelines = detail.content.guidelines_markdown.trim();
  const skill = detail.content.skill_markdown.trim();

  if (!detail.category || detail.category === "Custom") {
    addIssue(issues, {
      severity: "info",
      code: "DS_CATEGORY_GENERIC",
      target: "metadata.category",
      message: "Design system category is generic.",
      suggestion: "Set a product-oriented category such as Education, Developer Tools, SaaS, Dashboard, Docs, or Slides.",
    });
  }
  if (!detail.surface) {
    addIssue(issues, {
      severity: "warning",
      code: "DS_SURFACE_MISSING",
      target: "metadata.surface",
      message: "Design system surface is missing.",
      suggestion: "Set the primary surface: web, slides, docs, image, video, or audio.",
    });
  }

  const colorRows = flattenTokenRows(colors);
  if (colorRows.length < 6) {
    addIssue(issues, {
      severity: "warning",
      code: "DS_COLOR_ROLES_SPARSE",
      target: "tokens.colors",
      message: "Color tokens are too sparse for reliable agent use.",
      suggestion: "Define canvas, surface, ink, muted, line, accent, accentInk, and semantic state colors.",
    });
  }
  const canvas = findTokenByHints(colors, [/canvas/i, /surface/i, /background/i]);
  const ink = findTokenByHints(colors, [/ink/i, /text/i, /foreground/i]);
  if (canvas && ink) {
    const ratio = contrastRatio(canvas, ink);
    if (ratio !== null && ratio < 4.5) {
      addIssue(issues, {
        severity: "error",
        code: "DS_CONTRAST_LOW_TEXT",
        target: "tokens.colors",
        message: `Primary text contrast is ${ratio.toFixed(2)}:1, below WCAG AA body-text guidance.`,
        suggestion: "Adjust ink/canvas tokens to reach at least 4.5:1 contrast.",
      });
    }
  }
  for (const [name, value] of colorRows) {
    const raw = value.replaceAll("`", "").toLowerCase();
    if (["#6366f1", "#8b5cf6", "#7c3aed", "#4f46e5"].includes(raw)) {
      addIssue(issues, {
        severity: "info",
        code: "DS_AI_DEFAULT_ACCENT",
        target: `tokens.colors.${name}`,
        message: "Palette uses a common AI-default indigo/purple accent.",
        suggestion: "Keep it only if intentional; otherwise choose a category-specific accent.",
      });
    }
  }

  for (const role of ["body", "heading", "label"]) {
    if (!Object.hasOwn(typography, role)) {
      addIssue(issues, {
        severity: "warning",
        code: "DS_TYPOGRAPHY_ROLE_MISSING",
        target: `tokens.typography.${role}`,
        message: `Typography role '${role}' is missing.`,
        suggestion: "Define role-based typography tokens for agent-readable hierarchy.",
      });
    }
  }

  if (components.length === 0) {
    addIssue(issues, {
      severity: "warning",
      code: "DS_COMPONENTS_EMPTY",
      target: "components",
      message: "No component documents are registered.",
      suggestion: "Add at least button, input, card, select, dialog, alert, table, and badge for web/app systems.",
    });
  }
  for (const component of components) {
    if (!component.description) {
      addIssue(issues, {
        severity: "info",
        code: "DS_COMPONENT_DESCRIPTION_MISSING",
        target: `components.${component.name}.description`,
        message: `${component.name} has no description.`,
      });
    }
    const missing = missingStates(component);
    if (missing.length > 0) {
      addIssue(issues, {
        severity: "warning",
        code: "DS_COMPONENT_STATES_MISSING",
        target: `components.${component.name}.states`,
        message: `${component.name} is missing states: ${missing.join(", ")}.`,
        suggestion: "Document interaction states so agents can render consistent variants.",
      });
    }
    if ((component.framework === "tailwind" || component.framework === "shadcn") && component.classes.length === 0) {
      addIssue(issues, {
        severity: "warning",
        code: "DS_COMPONENT_CLASSES_MISSING",
        target: `components.${component.name}.classes`,
        message: `${component.name} is marked ${component.framework} but has no classes.`,
      });
    }
    if (component.framework === "shadcn" && component.install.length === 0) {
      addIssue(issues, {
        severity: "info",
        code: "DS_SHADCN_INSTALL_MISSING",
        target: `components.${component.name}.install`,
        message: `${component.name} has shadcn metadata but no install command.`,
      });
    }
  }

  if (!guidelines) {
    addIssue(issues, {
      severity: "warning",
      code: "DS_GUIDELINES_EMPTY",
      target: "guidelines",
      message: "Guidelines markdown is empty.",
    });
  }
  if (!skill) {
    addIssue(issues, {
      severity: "info",
      code: "DS_SKILL_EMPTY",
      target: "skill",
      message: "Skill markdown is empty.",
    });
  }

  const issueCounts = {
    error: issues.filter((issue) => issue.severity === "error").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };
  const score = Math.max(
    0,
    100 - issueCounts.error * 20 - issueCounts.warning * 8 - issueCounts.info * 2,
  );
  return {
    ok: issueCounts.error === 0,
    score,
    issue_counts: issueCounts,
    issues,
  };
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
  const lint = lintDesignSystem(detail);
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
- Category: \`${detail.category}\`
- Surface: \`${detail.surface}\`
- Status: \`${detail.status}\`
- Description: ${detail.description || "No description recorded."}

## Agent Quick Start

1. Read Identity, Usage, Guidelines, and Quality Signals before applying this
   system.
2. Use Color Palette and Typography as the canonical visual tokens. These are
   stored separately in BlueKiwi but merged here for agent consumption.
3. Use Component Inventory, Component Catalog, and Component Detail Access to
   choose the right component, states, variants, and implementation entrypoint.
4. Do not treat this file as the full source dump. For source code and large
   structured payloads, request \`export_design_system\` with
   \`format: "package"\`, \`format: "adapters"\`, or \`format: "bundle"\`.

## Usage

${detail.content.skill_markdown.trim() || "Use this design system when creating or editing user-facing visual materials."}

## Schema

\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

## Split Token Sources

| Source | Bundle Path | Entries | Purpose |
| --- | --- | ---: | --- |
| Colors | \`tokens/colors.json\` | ${flattenTokenRows(colors).length} | Semantic palette, surfaces, text, accents, states |
| Typography | \`tokens/typography.json\` | ${flattenTokenRows(typography).length} | Font families, sizes, weights, line heights, labels |
| Components | \`tokens/components.json\` | ${Object.keys(components).length} | Component specs for viewer, agents, and adapters |

## Color Palette

${markdownTable(flattenTokenRows(colors), "No color tokens recorded.")}

## Typography

${markdownTable(flattenTokenRows(typography), "No typography tokens recorded.")}

## Component Inventory

${componentInventoryMarkdown(componentDocs)}

## Component Catalog

${componentCatalogMarkdown(componentDocs)}

## Component Detail Access

- Use the Component Catalog above to choose the component name.
- For a single detailed component document, call \`get_design_component\`.
- For all component specs, load \`tokens/components.json\` from
  \`format: "package"\` or \`format: "bundle"\`.
- For implementation files, export \`format: "adapters"\`; React sources are
  under \`adapters/react/\`, HTML/CSS preview kit under \`adapters/html/\`, and
  shadcn metadata under \`adapters/shadcn-registry.json\`.
- Keep this \`DESIGN.md\` as the agent-readable usage summary, not the full
  source archive.

## Implementation Handoff

- Agent document: \`DESIGN.md\`
- Portable skill: \`SKILL.md\`
- Split tokens: \`tokens/colors.json\`, \`tokens/typography.json\`,
  \`tokens/components.json\`
- Tailwind config: \`adapters/tailwind.config.js\`
- shadcn registry: \`adapters/shadcn-registry.json\`
- React entrypoint: \`adapters/react/index.ts\`
- HTML preview kit: \`adapters/html/index.html\`,
  \`adapters/html/styles.css\`

## Quality Signals

${lintSummaryMarkdown(lint)}

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

function cssVariableName(prefix: string, name: string): string {
  const normalized = name
    .replaceAll(".", "-")
    .replace(/[^a-zA-Z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `--bk-${prefix}-${normalized || "value"}`;
}

function tokenPrimitiveValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (isPlainObject(value)) {
    const raw = value.$value ?? value.value ?? value.family;
    if (typeof raw === "string" || typeof raw === "number") {
      return String(raw);
    }
  }
  return null;
}

function tokenCssRows(
  value: Record<string, unknown>,
  prefix: string,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    const primitive = tokenPrimitiveValue(item);
    if (primitive !== null) {
      rows.push([name, primitive]);
      continue;
    }
    if (isPlainObject(item)) rows.push(...tokenCssRows(item, name));
  }
  return rows;
}

function buildAdapterTokensCss(detail: DesignSystemDetail): string {
  const colors = parseJsonObject(detail.content.color_tokens_json);
  const typography = parseJsonObject(detail.content.typography_tokens_json);
  const colorRows = tokenCssRows(colors, "").map(
    ([name, value]) => `  ${cssVariableName("color", name)}: ${value};`,
  );
  const typographyRows = tokenCssRows(typography, "").map(
    ([name, value]) => `  ${cssVariableName("font", name)}: ${value};`,
  );
  return `:root {
${[...colorRows, ...typographyRows].join("\n")}
}
`;
}

function tailwindKey(name: string): string {
  return name
    .split(".")
    .map((part) =>
      part
        .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase(),
    )
    .filter(Boolean)
    .join("-");
}

function buildTailwindConfig(detail: DesignSystemDetail): string {
  const colors = Object.fromEntries(
    tokenCssRows(parseJsonObject(detail.content.color_tokens_json), "").map(
      ([name]) => [tailwindKey(name), `var(${cssVariableName("color", name)})`],
    ),
  );
  const fontFamily = Object.fromEntries(
    tokenCssRows(parseJsonObject(detail.content.typography_tokens_json), "")
      .filter(([name]) => /family|body|heading|display|mono|label/i.test(name))
      .map(([name]) => [tailwindKey(name), `var(${cssVariableName("font", name)})`]),
  );
  return `/** Generated from BlueKiwi design system: ${detail.title} (${detail.slug}) */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 6)},
      fontFamily: ${JSON.stringify(fontFamily, null, 6)}
    }
  }
};
`;
}

function componentFileName(name: string): string {
  return `${name
    .replace(/[^a-zA-Z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "") || "Component"}.tsx`;
}

function componentIdentifier(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]+/g, "");
  const candidate = cleaned || "Component";
  return /^[a-zA-Z_$]/.test(candidate) ? candidate : `Component${candidate}`;
}

function buildReactSource(component: DesignSystemComponentDoc): string {
  if (component.react) return component.react;
  const classes = component.classes.join(" ");
  const html = component.html || `<div>${component.name}</div>`;
  return `export function ${componentIdentifier(component.name)}() {
  return (
    <div className=${JSON.stringify(classes)}>
      ${JSON.stringify(html)}
    </div>
  );
}
`;
}

function buildReactIndex(docs: DesignSystemComponentDoc[]): string {
  const reactDocs = docs.filter(
    (doc) => doc.react || doc.framework === "react" || doc.framework === "shadcn",
  );
  if (reactDocs.length === 0) {
    return "// No React component sources were registered in this design system.\n";
  }
  return reactDocs
    .map((doc) => `export * from "./${componentFileName(doc.name).replace(/\.tsx$/, "")}";`)
    .join("\n");
}

function buildShadcnRegistry(detail: DesignSystemDetail): string {
  const docs = buildDesignSystemComponentDocs(detail).filter(
    (doc) => doc.framework === "shadcn" || Object.keys(doc.shadcn).length > 0,
  );
  const items = docs.map((doc) => ({
    name: doc.name,
    type: "registry:component",
    title: doc.name,
    description: doc.description,
    dependencies: doc.dependencies,
    registryDependencies: stringArrayValue(doc.shadcn.registry_items),
    files: [
      {
        path: `components/${componentFileName(doc.name)}`,
        type: "registry:component",
        content: buildReactSource(doc),
      },
    ],
    cssVars: {
      light: Object.fromEntries(
        tokenCssRows(parseJsonObject(detail.content.color_tokens_json), "")
          .slice(0, 24)
          .map(([name, value]) => [cssVariableName("color", name), value]),
      ),
    },
  }));
  return JSON.stringify(
    {
      "$schema": "https://ui.shadcn.com/schema/registry.json",
      name: detail.slug,
      type: "registry:style",
      title: detail.title,
      description: detail.description,
      items,
    },
    null,
    2,
  );
}

function buildHtmlKit(detail: DesignSystemDetail): { html: string; css: string } {
  const docs = buildDesignSystemComponentDocs(detail);
  const css = [
    buildAdapterTokensCss(detail),
    "body { margin: 0; padding: 24px; background: var(--bk-color-canvas, #f8fafc); color: var(--bk-color-ink, #111827); font-family: var(--bk-font-body-family, system-ui, sans-serif); }",
    ".bk-preview-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }",
    ".bk-preview-item { border: 1px solid var(--bk-color-line, #e5e7eb); border-radius: 8px; padding: 16px; background: var(--bk-color-surface, #ffffff); }",
    ...docs.map((doc) => doc.css).filter(Boolean),
  ].join("\n\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(detail.title)} Preview Kit</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <h1>${escapeHtml(detail.title)}</h1>
  <main class="bk-preview-grid">
${docs
  .map(
    (doc) => `    <section class="bk-preview-item">
      <h2>${escapeHtml(doc.name)}</h2>
      ${doc.html || `<p>${escapeHtml(doc.description || "No preview HTML registered.")}</p>`}
    </section>`,
  )
  .join("\n")}
  </main>
</body>
</html>
`;
  return { html, css };
}

export function buildDesignSystemAdapterExport(detail: DesignSystemDetail) {
  const componentDocs = buildDesignSystemComponentDocs(detail);
  const htmlKit = buildHtmlKit(detail);
  const reactDocs = componentDocs.filter(
    (doc) => doc.react || doc.framework === "react" || doc.framework === "shadcn",
  );
  const files = [
    {
      path: "adapters/tokens.css",
      mime_type: "text/css",
      content: buildAdapterTokensCss(detail),
    },
    {
      path: "adapters/tailwind.config.js",
      mime_type: "text/javascript",
      content: buildTailwindConfig(detail),
    },
    {
      path: "adapters/shadcn-registry.json",
      mime_type: "application/json",
      content: buildShadcnRegistry(detail),
    },
    {
      path: "adapters/react/index.ts",
      mime_type: "text/typescript",
      content: buildReactIndex(componentDocs),
    },
    ...reactDocs.map((doc) => ({
      path: `adapters/react/${componentFileName(doc.name)}`,
      mime_type: "text/tsx",
      content: buildReactSource(doc),
    })),
    {
      path: "adapters/html/index.html",
      mime_type: "text/html",
      content: htmlKit.html,
    },
    {
      path: "adapters/html/styles.css",
      mime_type: "text/css",
      content: htmlKit.css,
    },
  ];

  return {
    format: "adapters",
    design_system: buildDesignSystemJsonExport(detail).design_system,
    adapters: {
      tailwind: "adapters/tailwind.config.js",
      shadcn: "adapters/shadcn-registry.json",
      react: "adapters/react/index.ts",
      html: "adapters/html/index.html",
      css_tokens: "adapters/tokens.css",
    },
    files,
  };
}

function buildDesignSystemPackageManifest(input: {
  detail: DesignSystemDetail;
  componentDocs: DesignSystemComponentDoc[];
  files: Array<{ path: string; mime_type: string }>;
  lint: DesignSystemLintResult;
}) {
  const { detail, componentDocs, files, lint } = input;
  return {
    package_schema_version: "bluekiwi.design-package.v1",
    source: "bluekiwi-registry",
    generated_at: detail.updated_at,
    design_system: {
      id: detail.id,
      title: detail.title,
      slug: detail.slug,
      version: detail.version,
      category: detail.category,
      surface: detail.surface,
      status: detail.status,
      family_root_id: detail.family_root_id,
      is_active: detail.is_active,
    },
    entrypoints: {
      agent_document: "DESIGN.md",
      portable_skill: "SKILL.md",
      package_manifest: "design-package.json",
      component_docs: "components/README.md",
    },
    tokens: {
      colors: "tokens/colors.json",
      typography: "tokens/typography.json",
      components: "tokens/components.json",
    },
    adapters: {
      css_tokens: "adapters/tokens.css",
      tailwind: "adapters/tailwind.config.js",
      shadcn: "adapters/shadcn-registry.json",
      react: "adapters/react/index.ts",
      html: "adapters/html/index.html",
    },
    components: componentDocs.map((doc) => ({
      name: doc.name,
      framework: doc.framework,
      style_system: doc.styleSystem,
      states: doc.states,
      variants: doc.variants,
      source_types: componentSourceTypes(doc),
      react_path:
        doc.react || doc.framework === "react" || doc.framework === "shadcn"
          ? `adapters/react/${componentFileName(doc.name)}`
          : null,
    })),
    assets: detail.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      path: asset.content_text === null ? null : `assets/${asset.filename}`,
    })),
    quality: {
      ok: lint.ok,
      score: lint.score,
      issue_counts: lint.issue_counts,
    },
    import_hints: {
      preferred_agent_entrypoint: "DESIGN.md",
      preferred_implementation_entrypoint: "adapters/tokens.css",
      version_strategy:
        "Create a new BlueKiwi design-system version for material updates; preserve family_root_id lineage when importing related revisions.",
      merge_strategy:
        "Treat tokens/colors.json, tokens/typography.json, and tokens/components.json as split canonical sections. Merge category-level changes with scoped tools instead of replacing the full system.",
    },
    files: files.map((file) => ({
      path: file.path,
      mime_type: file.mime_type,
    })),
  };
}

function componentSourceTypes(component: DesignSystemComponentDoc): string[] {
  return [
    component.react ? "react" : "",
    component.html ? "html" : "",
    component.css ? "css" : "",
    Object.keys(component.tailwind).length > 0 ? "tailwind" : "",
    Object.keys(component.shadcn).length > 0 ? "shadcn" : "",
  ].filter(Boolean);
}

function packageFileMap(pkg: Record<string, unknown>): Map<string, string> {
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const map = new Map<string, string>();
  for (const item of files) {
    if (!isPlainObject(item)) continue;
    const path = typeof item.path === "string" ? item.path : "";
    const content = typeof item.content === "string" ? item.content : "";
    if (path) map.set(path, content);
  }
  return map;
}

function fileJson(
  files: Map<string, string>,
  path: string,
  fallback: unknown,
): unknown {
  return files.has(path) ? parseJsonValue(files.get(path) ?? "", fallback) : fallback;
}

function fileText(files: Map<string, string>, path: string): string {
  return files.get(path)?.trim() ?? "";
}

function inferAssetKind(filename: string, mimeType: string): DesignSystemAssetKind {
  if (/image\//i.test(mimeType)) return "image";
  if (/css/i.test(mimeType) || /\.css$/i.test(filename)) return "css";
  if (/html|tsx|jsx|template/i.test(mimeType) || /\.(html|tsx|jsx)$/i.test(filename)) {
    return "template";
  }
  if (/markdown|json|text/i.test(mimeType) || /\.(md|json|txt)$/i.test(filename)) {
    return "reference";
  }
  return "other";
}

function topLevelObjectCount(value: unknown): number {
  return isPlainObject(value) ? Object.keys(value).length : 0;
}

export function parseDesignSystemPackageExport(input: unknown): ParsedDesignSystemPackage {
  const pkg = isPlainObject(input) ? input : {};
  const files = packageFileMap(pkg);
  const manifest = recordValue(pkg.package_manifest);
  const manifestSystem = recordValue(manifest.design_system);
  const designSystem = {
    ...manifestSystem,
    ...recordValue(pkg.design_system),
  };
  const tokenSections = recordValue(pkg.token_sections);

  const title =
    stringValue(designSystem.title) ||
    stringValue(pkg.title) ||
    "Imported Design System";
  const slug = stringValue(designSystem.slug) || undefined;
  const description =
    stringValue(designSystem.description) ||
    stringValue(pkg.description) ||
    `Imported BlueKiwi design package for ${title}.`;

  const colorTokens =
    fileJson(files, "tokens/colors.json", undefined) ??
    recordValue(tokenSections.color);
  const typographyTokens =
    fileJson(files, "tokens/typography.json", undefined) ??
    recordValue(tokenSections.typography);
  const componentTokens =
    fileJson(files, "tokens/components.json", undefined) ??
    recordValue(tokenSections.components);
  const tokens =
    fileJson(files, "tokens/all.json", undefined) ??
    (isPlainObject(pkg.tokens)
      ? pkg.tokens
      : {
          color: colorTokens,
          typography: typographyTokens,
          components: componentTokens,
        });

  const assets = Array.from(files.entries())
    .filter(([path]) => path.startsWith("assets/"))
    .map(([path, content]) => {
      const filename = path.replace(/^assets\//, "");
      const manifestAsset = Array.isArray(manifest.assets)
        ? manifest.assets.find(
            (asset) =>
              isPlainObject(asset) &&
              (asset.path === path || asset.filename === filename),
          )
        : null;
      const mimeType =
        isPlainObject(manifestAsset) && typeof manifestAsset.mime_type === "string"
          ? manifestAsset.mime_type
          : "text/plain";
      const rawKind =
        isPlainObject(manifestAsset) && typeof manifestAsset.kind === "string"
          ? manifestAsset.kind
          : "";
      const kind = SUPPORTED_ASSET_KINDS.includes(rawKind as DesignSystemAssetKind)
        ? (rawKind as DesignSystemAssetKind)
        : inferAssetKind(filename, mimeType);
      return {
        kind,
        filename,
        mimeType,
        contentText: content,
      };
    });

  return {
    title,
    slug,
    description,
    version: stringValue(designSystem.version) || undefined,
    category: stringValue(designSystem.category) || undefined,
    surface: stringValue(designSystem.surface) || undefined,
    schema: fileJson(files, "schema.json", recordValue(pkg.schema)),
    tokens,
    colorTokens,
    typographyTokens,
    componentTokens,
    guidelinesMarkdown:
      fileText(files, "docs/guidelines.md") ||
      stringValue(pkg.guidelines_markdown),
    skillMarkdown:
      fileText(files, "docs/skill.md") || stringValue(pkg.skill_markdown),
    exportManifest:
      isPlainObject(pkg.export_manifest) || Array.isArray(pkg.export_manifest)
        ? pkg.export_manifest
        : {
            imported_from: "bluekiwi-design-package",
            package_schema_version: stringValue(manifest.package_schema_version),
          },
    assets,
  };
}

export function analyzeDesignSystemPackage(
  input: unknown,
  candidates: DesignSystem[] = [],
): DesignSystemPackageAnalysis {
  const parsed = parseDesignSystemPackageExport(input);
  const normalizedSlug = parsed.slug?.toLowerCase() ?? "";
  const normalizedTitle = parsed.title.toLowerCase();
  const normalizedCategory = parsed.category?.toLowerCase() ?? "";
  const normalizedSurface = parsed.surface?.toLowerCase() ?? "";

  const relatedSystems = candidates
    .map((candidate) => {
      const reasons: string[] = [];
      let score = 0;
      if (normalizedSlug && candidate.slug.toLowerCase() === normalizedSlug) {
        score += 100;
        reasons.push("same slug");
      }
      if (candidate.title.toLowerCase() === normalizedTitle) {
        score += 80;
        reasons.push("same title");
      }
      if (
        normalizedCategory &&
        candidate.category.toLowerCase() === normalizedCategory
      ) {
        score += 10;
        reasons.push("same category");
      }
      if (
        normalizedSurface &&
        candidate.surface.toLowerCase() === normalizedSurface
      ) {
        score += 10;
        reasons.push("same surface");
      }
      return {
        id: candidate.id,
        title: candidate.title,
        slug: candidate.slug,
        version: candidate.version,
        category: candidate.category,
        surface: candidate.surface,
        status: candidate.status,
        is_active: candidate.is_active,
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8);

  const suggestedTarget = relatedSystems.find((candidate) =>
    candidate.reasons.some(
      (reason) => reason === "same slug" || reason === "same title",
    ),
  );

  return {
    summary: {
      title: parsed.title,
      slug: parsed.slug ?? null,
      description: parsed.description,
      version: parsed.version ?? "1.0.0",
      category: parsed.category ?? "Imported",
      surface: parsed.surface ?? "web",
    },
    counts: {
      colors: topLevelObjectCount(parsed.colorTokens),
      typography: topLevelObjectCount(parsed.typographyTokens),
      components: topLevelObjectCount(parsed.componentTokens),
      assets: parsed.assets.length,
      guidelines_chars: parsed.guidelinesMarkdown.length,
      skill_chars: parsed.skillMarkdown.length,
    },
    related_systems: relatedSystems,
    recommended_mode: suggestedTarget ? "version" : "create",
    suggested_target_design_system_id: suggestedTarget?.id ?? null,
  };
}

export function buildDesignSystemBundleExport(detail: DesignSystemDetail) {
  const componentDocs = buildDesignSystemComponentDocs(detail);
  const json = buildDesignSystemJsonExport(detail);
  const adapterExport = buildDesignSystemAdapterExport(detail);
  const lint = lintDesignSystem(detail);
  const baseFiles = [
    {
      path: "DESIGN.md",
      mime_type: "text/markdown",
      content: buildDesignSystemDesignMarkdownExport(detail),
    },
    {
      path: "SKILL.md",
      mime_type: "text/markdown",
      content: buildDesignSystemSkillExport(detail),
    },
    {
      path: "schema.json",
      mime_type: "application/json",
      content: JSON.stringify(parseJsonObject(detail.content.schema_json), null, 2),
    },
    {
      path: "tokens/all.json",
      mime_type: "application/json",
      content: JSON.stringify(parseJsonObject(detail.content.tokens_json), null, 2),
    },
    {
      path: "tokens/colors.json",
      mime_type: "application/json",
      content: JSON.stringify(parseJsonObject(detail.content.color_tokens_json), null, 2),
    },
    {
      path: "tokens/typography.json",
      mime_type: "application/json",
      content: JSON.stringify(parseJsonObject(detail.content.typography_tokens_json), null, 2),
    },
    {
      path: "tokens/components.json",
      mime_type: "application/json",
      content: JSON.stringify(parseJsonObject(detail.content.component_tokens_json), null, 2),
    },
    {
      path: "components/README.md",
      mime_type: "text/markdown",
      content: componentDocsMarkdown(componentDocs),
    },
    {
      path: "docs/guidelines.md",
      mime_type: "text/markdown",
      content: detail.content.guidelines_markdown,
    },
    {
      path: "docs/skill.md",
      mime_type: "text/markdown",
      content: detail.content.skill_markdown,
    },
    ...detail.assets
      .filter((asset) => asset.content_text !== null)
      .map((asset) => ({
        path: `assets/${asset.filename}`,
        mime_type: asset.mime_type,
        content: asset.content_text ?? "",
      })),
    ...adapterExport.files,
  ];
  const packageManifest = buildDesignSystemPackageManifest({
    detail,
    componentDocs,
    files: [
      ...baseFiles,
      { path: "design-package.json", mime_type: "application/json" },
      { path: "manifest.json", mime_type: "application/json" },
    ],
    lint,
  });
  const files = [
    ...baseFiles,
    {
      path: "design-package.json",
      mime_type: "application/json",
      content: JSON.stringify(packageManifest, null, 2),
    },
    {
      path: "manifest.json",
      mime_type: "application/json",
      content: JSON.stringify(packageManifest, null, 2),
    },
  ];

  return {
    format: "bundle",
    design_system: json.design_system,
    package_manifest: packageManifest,
    lint,
    files,
  };
}

export function buildDesignSystemPackageExport(detail: DesignSystemDetail) {
  return {
    ...buildDesignSystemBundleExport(detail),
    format: "package",
  };
}

export function buildDesignSystemPreviewHtml(detail: DesignSystemDetail): string {
  const colors = parseJsonObject(detail.content.color_tokens_json);
  const typography = parseJsonObject(detail.content.typography_tokens_json);
  const componentDocs = buildDesignSystemComponentDocs(detail);
  const flatColors = flattenTokenRows(colors).slice(0, 24);
  const flatTypography = flattenTokenRows(typography).slice(0, 16);
  const primary =
    safeCssToken(
      flatColors.find(([, value]) => /^`#[0-9a-fA-F]{6}`$/.test(value))?.[1]
        .replaceAll("`", "") ?? "#256D85",
      "#256D85",
    );
  const surface =
    safeCssToken(
      flatColors
        .find(([name]) => /surface|paper|background|canvas/i.test(name))?.[1]
        .replaceAll("`", "") ?? "#FFFFFF",
      "#FFFFFF",
    );
  const text =
    safeCssToken(
      flatColors
        .find(([name]) => /text|ink|foreground/i.test(name))?.[1]
        .replaceAll("`", "") ?? "#111827",
      "#111827",
    );
  const bodyFont =
    safeCssToken(
      flatTypography.find(([name]) => /body|ui|sans|font/i.test(name))?.[1]
        .replaceAll("`", "") ?? "Inter, system-ui, sans-serif",
      "Inter, system-ui, sans-serif",
    );

  const swatches = flatColors
    .map(
      ([name, value]) => `<div class="swatch">
        <span style="background:${escapeHtml(safeCssToken(value.replaceAll("`", ""), "#FFFFFF"))}"></span>
        <strong>${escapeHtml(name)}</strong>
        <code>${escapeHtml(value.replaceAll("`", ""))}</code>
      </div>`,
    )
    .join("");
  const typeRows = flatTypography
    .map(
      ([name, value]) => `<div class="type-row">
        <span>${escapeHtml(name)}</span>
        <strong style="font-family:${escapeHtml(value.replaceAll("`", ""))}">${escapeHtml(value.replaceAll("`", ""))}</strong>
      </div>`,
    )
    .join("");
  const components = componentDocs
    .slice(0, 12)
    .map((component) => {
      const preview = component.html
        ? `<iframe title="${escapeHtml(component.name)} preview" sandbox srcdoc="${escapeHtml(`<!doctype html><html><head><style>body{margin:0;padding:20px;font-family:${bodyFont};background:${surface};color:${text}}${component.css}</style></head><body>${component.html}</body></html>`)}"></iframe>`
        : `<div class="component-empty">No HTML preview</div>`;
      return `<article class="component">
        <div class="component-head">
          <strong>${escapeHtml(component.name)}</strong>
          <span>${escapeHtml(component.framework)}</span>
        </div>
        ${preview}
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(detail.title)} Preview</title>
  <style>
    :root { --primary:${primary}; --surface:${surface}; --text:${text}; }
    * { box-sizing: border-box; }
    body { margin:0; background:#f6f8fb; color:var(--text); font-family:${bodyFont}; }
    main { max-width:1180px; margin:0 auto; padding:32px; }
    header { display:grid; gap:12px; padding:28px; border:1px solid #dce4ee; border-radius:12px; background:var(--surface); }
    h1 { margin:0; font-size:36px; line-height:1.1; letter-spacing:-0.02em; }
    p { margin:0; color:#667085; line-height:1.6; }
    .meta { display:flex; flex-wrap:wrap; gap:8px; }
    .pill { border:1px solid #dce4ee; border-radius:999px; padding:6px 10px; font-size:12px; background:#fff; }
    .cta { width:max-content; border:0; border-radius:8px; padding:12px 16px; color:#fff; background:var(--primary); font-weight:700; }
    section { margin-top:20px; padding:22px; border:1px solid #dce4ee; border-radius:12px; background:#fff; }
    h2 { margin:0 0 16px; font-size:18px; }
    .swatches { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
    .swatch { display:grid; grid-template-columns:38px 1fr; gap:3px 10px; align-items:center; min-width:0; }
    .swatch span { grid-row:1/3; width:38px; height:38px; border:1px solid #dce4ee; border-radius:8px; }
    code { color:#475467; font-size:12px; }
    .type-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid #eef2f6; }
    .components { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
    .component { overflow:hidden; border:1px solid #dce4ee; border-radius:10px; }
    .component-head { display:flex; justify-content:space-between; gap:12px; padding:10px 12px; border-bottom:1px solid #eef2f6; font-size:13px; }
    iframe { width:100%; height:180px; border:0; background:#fff; }
    .component-empty { display:grid; height:180px; place-items:center; color:#98a2b3; font-size:13px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="meta">
        <span class="pill">${escapeHtml(detail.category)}</span>
        <span class="pill">${escapeHtml(detail.surface)}</span>
        <span class="pill">v${escapeHtml(detail.version)}</span>
      </div>
      <h1>${escapeHtml(detail.title)}</h1>
      <p>${escapeHtml(detail.description || "No description recorded.")}</p>
      <button class="cta">Primary Action</button>
    </header>
    <section>
      <h2>Color Palette</h2>
      <div class="swatches">${swatches || "<p>No color tokens recorded.</p>"}</div>
    </section>
    <section>
      <h2>Typography</h2>
      ${typeRows || "<p>No typography tokens recorded.</p>"}
    </section>
    <section>
      <h2>Components</h2>
      <div class="components">${components || "<p>No component previews recorded.</p>"}</div>
    </section>
  </main>
</body>
</html>`;
}
