"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Box,
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  GitCompare,
  History,
  Info,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type JsonMap = Record<string, unknown>;

type TokenEntry = {
  path: string;
  value: string;
};

interface DesignSystemDetail {
  id: number;
  title: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  surface: string;
  status: string;
  content: {
    schema_json: string;
    tokens_json: string;
    color_tokens_json: string;
    typography_tokens_json: string;
    component_tokens_json: string;
    guidelines_markdown: string;
    skill_markdown: string;
    export_manifest_json: string;
  };
  assets: Array<{
    id: number;
    kind: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    content_text: string | null;
    content_base64: string | null;
  }>;
}

interface DesignSystemVersionItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  surface: string;
  status: string;
  family_root_id: number;
  parent_design_system_id: number | null;
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

interface DesignSystemVersionSummary {
  family_root_id: number;
  active_version_id: number | null;
  versions: DesignSystemVersionItem[];
}

type ComponentDoc = {
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
  props: Array<JsonMap>;
  variants: string[];
  states: string[];
  classes: string[];
  dependencies: string[];
  install: string[];
  tailwind: JsonMap;
  shadcn: JsonMap;
  html: string;
  css: string;
  react: string;
  usage: string;
  sourceAssets: string[];
  raw: JsonMap;
};

function parseJsonMap(value: string): JsonMap {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonMap)
      : {};
  } catch {
    return {};
  }
}

function stringifyJson(value: JsonMap): string {
  return JSON.stringify(value, null, 2);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function primitiveTokenValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as JsonMap;
    const raw = record.$value ?? record.value ?? record.family;
    if (typeof raw === "string" || typeof raw === "number") return String(raw);
  }
  return null;
}

function flattenTokenEntries(value: JsonMap, prefix = ""): TokenEntry[] {
  const entries: TokenEntry[] = [];
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const primitive = primitiveTokenValue(item);
    if (primitive !== null) {
      entries.push({ path, value: primitive });
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      entries.push(...flattenTokenEntries(item as JsonMap, path));
    }
  }
  return entries;
}

function setJsonPathEntry(json: string, path: string, value: unknown): string {
  const next = parseJsonMap(json);
  const parts = path
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return stringifyJson(next);
  let target: JsonMap = next;
  for (const part of parts.slice(0, -1)) {
    if (
      !target[part] ||
      typeof target[part] !== "object" ||
      Array.isArray(target[part])
    ) {
      target[part] = {};
    }
    target = target[part] as JsonMap;
  }
  target[parts[parts.length - 1]] = value;
  return stringifyJson(next);
}

function deleteJsonPathEntry(json: string, path: string): string {
  const next = parseJsonMap(json);
  const parts = path
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return stringifyJson(next);
  let target: JsonMap = next;
  for (const part of parts.slice(0, -1)) {
    const child = target[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      return stringifyJson(next);
    }
    target = child as JsonMap;
  }
  delete target[parts[parts.length - 1]];
  return stringifyJson(next);
}

function renameJsonPathEntry(json: string, from: string, to: string): string {
  const trimmed = to.trim();
  if (!trimmed || trimmed === from) return json;
  const source = flattenTokenEntries(parseJsonMap(json)).find(
    (entry) => entry.path === from,
  );
  if (!source) return json;
  return setJsonPathEntry(deleteJsonPathEntry(json, from), trimmed, source.value);
}

function updateContent(
  detail: DesignSystemDetail,
  patch: Partial<DesignSystemDetail["content"]>,
): DesignSystemDetail {
  return { ...detail, content: { ...detail.content, ...patch } };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
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
    return [
      ...new Set(
        value
          .map((item) => (typeof item === "string" ? normalize(item) : ""))
          .filter(Boolean),
      ),
    ];
  }
  if (typeof value === "string" && value.trim()) return [normalize(value)];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).map(normalize).filter(Boolean);
  }
  return [];
}

function propsValue(value: unknown): Array<JsonMap> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is JsonMap =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

function resolveFramework(spec: JsonMap): ComponentDoc["framework"] {
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
  const source = objectValue(spec.source);
  const preview = objectValue(spec.preview);
  if (Object.keys(objectValue(spec.shadcn)).length > 0) return "shadcn";
  if (Object.keys(objectValue(spec.shadcn_ui)).length > 0) return "shadcn";
  if (
    Object.keys(objectValue(spec.tailwind)).length > 0 ||
    stringValue(spec.className) ||
    stringValue(spec.class_name) ||
    Array.isArray(spec.classes)
  ) {
    return "tailwind";
  }
  if (stringValue(spec.react) || stringValue(source.react)) return "react";
  if (
    stringValue(spec.html) ||
    stringValue(source.html) ||
    stringValue(preview.html)
  ) {
    return "html";
  }
  return "tokens";
}

function componentDocsFromTokens(tokens: JsonMap): ComponentDoc[] {
  return Object.entries(tokens).map(([name, value]) => {
    const spec = objectValue(value);
    const preview = objectValue(spec.preview);
    const source = objectValue(spec.source);
    const tailwind = objectValue(spec.tailwind);
    const shadcn = {
      ...objectValue(spec.shadcn),
      ...objectValue(spec.shadcn_ui),
    };
    return {
      name,
      framework: resolveFramework(spec),
      styleSystem:
        stringValue(spec.style_system) ||
        stringValue(spec.styleSystem) ||
        (Object.keys(shadcn).length > 0
          ? "shadcn/ui + Tailwind CSS"
          : Object.keys(tailwind).length > 0
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

function componentPreviewHtml(component: ComponentDoc): string {
  return component.html
    ? `<!doctype html><html><head><style>body{margin:0;padding:24px;font-family:Inter,system-ui,sans-serif;background:#fff;color:#111827;}${component.css}</style></head><body>${component.html}</body></html>`
    : "";
}

function componentRawRows(component: ComponentDoc): Array<[string, unknown]> {
  return Object.entries(component.raw).filter(
    ([key]) =>
      ![
        "description",
        "framework",
        "style_system",
        "styleSystem",
        "props",
        "variants",
        "states",
        "state",
        "interaction_states",
        "classes",
        "className",
        "class_name",
        "dependencies",
        "install",
        "install_commands",
        "installCommands",
        "tailwind",
        "shadcn",
        "shadcn_ui",
        "preview",
        "source",
        "html",
        "css",
        "react",
        "usage",
        "guidelines",
        "assets",
      ].includes(key),
  );
}

function missingComponentStates(component: ComponentDoc): string[] {
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

export default function DesignSystemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [detail, setDetail] = useState<DesignSystemDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [exportContent, setExportContent] = useState("");
  const [versionSummary, setVersionSummary] =
    useState<DesignSystemVersionSummary | null>(null);
  const [activeDesignSystemId, setActiveDesignSystemId] = useState<number | null>(
    null,
  );
  const [selectedComponentName, setSelectedComponentName] = useState<
    string | null
  >(null);
  const [componentSearch, setComponentSearch] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("all");

  useEffect(() => {
    void load();
    void loadActive();
    void loadVersions();
    async function load() {
      const res = await fetch(`/api/design-systems/${id}`);
      const json = await res.json();
      setDetail(json.data ?? null);
    }
    async function loadActive() {
      const res = await fetch("/api/design-systems/active");
      const json = await res.json();
      setActiveDesignSystemId(json.data?.active?.id ?? null);
    }
    async function loadVersions() {
      const res = await fetch(`/api/design-systems/${id}/versions`);
      const json = await res.json();
      setVersionSummary(json.data ?? null);
    }
  }, [id]);

  const colorTokens = useMemo(
    () => parseJsonMap(detail?.content.color_tokens_json ?? "{}"),
    [detail?.content.color_tokens_json],
  );
  const typographyTokens = useMemo(
    () => parseJsonMap(detail?.content.typography_tokens_json ?? "{}"),
    [detail?.content.typography_tokens_json],
  );
  const componentTokens = useMemo(
    () => parseJsonMap(detail?.content.component_tokens_json ?? "{}"),
    [detail?.content.component_tokens_json],
  );
  const componentDocs = useMemo(
    () => componentDocsFromTokens(componentTokens),
    [componentTokens],
  );
  const colorEntries = useMemo(
    () => flattenTokenEntries(colorTokens),
    [colorTokens],
  );
  const typographyEntries = useMemo(
    () => flattenTokenEntries(typographyTokens),
    [typographyTokens],
  );
  const componentFrameworks = useMemo(
    () => [
      "all",
      ...Array.from(new Set(componentDocs.map((item) => item.framework))).sort(),
    ],
    [componentDocs],
  );
  const filteredComponentDocs = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    return componentDocs.filter((component) => {
      const matchesFramework =
        frameworkFilter === "all" || component.framework === frameworkFilter;
      const searchable = [
        component.name,
        component.framework,
        component.styleSystem,
        component.description,
        component.usage,
        ...component.variants,
        ...component.states,
      ]
        .join(" ")
        .toLowerCase();
      return matchesFramework && (!query || searchable.includes(query));
    });
  }, [componentDocs, componentSearch, frameworkFilter]);
  const selectedComponent = useMemo(
    () =>
      componentDocs.find((component) => component.name === selectedComponentName) ??
      null,
    [componentDocs, selectedComponentName],
  );

  function updateDetail(next: DesignSystemDetail) {
    setDetail(next);
    setMessage("");
  }

  async function save() {
    if (!detail) return;
    setSaving(true);
    setMessage("");
    try {
      const color_tokens = parseJsonMap(detail.content.color_tokens_json);
      const typography_tokens = parseJsonMap(
        detail.content.typography_tokens_json,
      );
      const component_tokens = parseJsonMap(detail.content.component_tokens_json);
      const tokens = {
        ...parseJsonMap(detail.content.tokens_json),
        color: color_tokens,
        typography: typography_tokens,
        components: component_tokens,
      };
      const res = await fetch(`/api/design-systems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detail.title,
          slug: detail.slug,
          description: detail.description,
          category: detail.category,
          surface: detail.surface,
          schema: parseJsonMap(detail.content.schema_json),
          tokens,
          color_tokens,
          typography_tokens,
          component_tokens,
          guidelines_markdown: detail.content.guidelines_markdown,
          skill_markdown: detail.content.skill_markdown,
          export_manifest: parseJsonMap(detail.content.export_manifest_json),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed");
      setDetail(json.data);
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function exportAs(
    format: "json" | "skill" | "design" | "bundle" | "adapters",
  ) {
    const res = await fetch(`/api/design-systems/${id}/export?format=${format}`);
    const json = await res.json();
    setExportContent(
      format === "json" || format === "bundle" || format === "adapters"
        ? JSON.stringify(json.data ?? {}, null, 2)
        : json.data?.content ?? "",
    );
  }

  async function runLint() {
    const res = await fetch(`/api/design-systems/${id}/lint`, {
      method: "POST",
    });
    const json = await res.json();
    setExportContent(JSON.stringify(json.data ?? {}, null, 2));
  }

  async function setActiveDesignSystem() {
    const res = await fetch("/api/design-systems/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_system_id: Number(id) }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json?.error?.message ?? "Failed to set active design system");
      return;
    }
    setActiveDesignSystemId(json.data?.active?.id ?? Number(id));
    setMessage("Set as active design system");
  }

  async function clearActiveDesignSystem() {
    const res = await fetch("/api/design-systems/active", { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error?.message ?? "Failed to clear active design system");
      return;
    }
    setActiveDesignSystemId(null);
    setMessage("Active design system cleared");
  }

  async function compareVersion(versionId: number) {
    const activeVersionId = versionSummary?.active_version_id;
    if (!activeVersionId) {
      setMessage("No active version to compare");
      return;
    }
    const res = await fetch(
      `/api/design-systems/${id}/versions/compare?from=${activeVersionId}&to=${versionId}`,
    );
    const json = await res.json();
    setExportContent(JSON.stringify(json.data ?? json.error ?? {}, null, 2));
    if (!res.ok) {
      setMessage(json?.error?.message ?? "Version compare failed");
    }
  }

  async function activateVersion(versionId: number) {
    const res = await fetch(`/api/design-systems/${versionId}/activate`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json?.error?.message ?? "Version activation failed");
      return;
    }
    setMessage(
      json.data?.already_active
        ? "Version is already active"
        : `Activated version ${versionId}`,
    );
    const versionsRes = await fetch(`/api/design-systems/${versionId}/versions`);
    const versionsJson = await versionsRes.json();
    setVersionSummary(versionsJson.data ?? null);
    if (versionId === Number(id)) {
      if (json.data?.design_system) setDetail(json.data.design_system);
    } else {
      router.push(`/design-systems/${versionId}`);
    }
  }

  if (!detail) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        Loading design system...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {detail.title}
              </h1>
              <Badge variant="success">v{detail.version}</Badge>
              {activeDesignSystemId === detail.id ? (
                <Badge variant="accent">Active</Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{detail.slug}</p>
              <Badge variant="secondary">{detail.category}</Badge>
              <Badge variant="neutral">{detail.surface}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportAs("design")}>
              <FileText className="h-4 w-4" />
              DESIGN.md
            </Button>
            <Button variant="outline" onClick={() => exportAs("json")}>
              <Download className="h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" onClick={() => exportAs("bundle")}>
              <Download className="h-4 w-4" />
              Bundle
            </Button>
            <Button variant="outline" onClick={() => exportAs("adapters")}>
              <Code2 className="h-4 w-4" />
              Adapters
            </Button>
            <Button variant="outline" onClick={() => exportAs("skill")}>
              <Download className="h-4 w-4" />
              Skill
            </Button>
            <Button variant="outline" onClick={runLint}>
              <Info className="h-4 w-4" />
              Lint
            </Button>
            {activeDesignSystemId === detail.id ? (
              <Button variant="outline" onClick={clearActiveDesignSystem}>
                <X className="h-4 w-4" />
                Clear Active
              </Button>
            ) : (
              <Button variant="outline" onClick={setActiveDesignSystem}>
                <Check className="h-4 w-4" />
                Set Active
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
      </header>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <Panel title="Identity" icon={<FileText className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={detail.title}
                onChange={(event) =>
                  updateDetail({ ...detail, title: event.target.value })
                }
              />
              <Input
                value={detail.slug}
                onChange={(event) =>
                  updateDetail({ ...detail, slug: event.target.value })
                }
              />
              <Input
                value={detail.category}
                placeholder="Category"
                onChange={(event) =>
                  updateDetail({ ...detail, category: event.target.value })
                }
              />
              <Input
                value={detail.surface}
                placeholder="surface: web, slides, docs..."
                onChange={(event) =>
                  updateDetail({ ...detail, surface: event.target.value })
                }
              />
              <Textarea
                className="md:col-span-2"
                value={detail.description}
                onChange={(event) =>
                  updateDetail({ ...detail, description: event.target.value })
                }
              />
            </div>
          </Panel>

          <Panel title="Showcase Preview" icon={<Layers className="h-4 w-4" />}>
            <iframe
              className="h-[520px] w-full rounded-lg border border-border bg-white"
              title={`${detail.title} showcase preview`}
              src={`/api/design-systems/${id}/preview`}
            />
          </Panel>

          <Panel title="Color Palette" icon={<Palette className="h-4 w-4" />}>
            <div className="mb-4 overflow-hidden rounded-lg border border-border">
              <div className="flex h-16">
                {colorEntries.filter((entry) => isHexColor(entry.value)).length >
                0 ? (
                  colorEntries
                    .filter((entry) => isHexColor(entry.value))
                    .slice(0, 12)
                    .map((entry) => (
                      <div
                        key={entry.path}
                        className="min-w-12 flex-1"
                        style={{ background: entry.value }}
                        title={`${entry.path}: ${entry.value}`}
                      />
                    ))
                ) : (
                  <div className="flex flex-1 items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                    No hex palette tokens.
                  </div>
                )}
              </div>
              <div className="grid gap-0 border-t border-border sm:grid-cols-3">
                <PaletteMetric label="Tokens" value={colorEntries.length} />
                <PaletteMetric
                  label="Hex Colors"
                  value={colorEntries.filter((entry) => isHexColor(entry.value)).length}
                />
                <PaletteMetric
                  label="Nested Paths"
                  value={
                    colorEntries.filter((entry) => entry.path.includes("."))
                      .length
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {colorEntries.map((entry) => (
                <ColorToken
                  key={entry.path}
                  name={entry.path}
                  value={entry.value}
                  onRename={(nextName) =>
                    updateDetail(
                      updateContent(detail, {
                        color_tokens_json: renameJsonPathEntry(
                          detail.content.color_tokens_json,
                          entry.path,
                          nextName,
                        ),
                      }),
                    )
                  }
                  onChange={(nextValue) =>
                    updateDetail(
                      updateContent(detail, {
                        color_tokens_json: setJsonPathEntry(
                          detail.content.color_tokens_json,
                          entry.path,
                          nextValue,
                        ),
                      }),
                    )
                  }
                  onDelete={() =>
                    updateDetail(
                      updateContent(detail, {
                        color_tokens_json: deleteJsonPathEntry(
                          detail.content.color_tokens_json,
                          entry.path,
                        ),
                      }),
                    )
                  }
                />
              ))}
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() =>
                updateDetail(
                  updateContent(detail, {
                    color_tokens_json: setJsonPathEntry(
                      detail.content.color_tokens_json,
                      `color${colorEntries.length + 1}`,
                      "#256D85",
                    ),
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add Color
            </Button>
          </Panel>

          <Panel title="Typography" icon={<Type className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {typographyEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No typography tokens registered.
                </p>
              ) : (
                typographyEntries.map((entry) => (
                  <TypographyToken
                    key={entry.path}
                    name={entry.path}
                    value={entry.value}
                    onRename={(nextName) =>
                      updateDetail(
                        updateContent(detail, {
                          typography_tokens_json: renameJsonPathEntry(
                            detail.content.typography_tokens_json,
                            entry.path,
                            nextName,
                          ),
                        }),
                      )
                    }
                    onChange={(nextValue) =>
                      updateDetail(
                        updateContent(detail, {
                          typography_tokens_json: setJsonPathEntry(
                            detail.content.typography_tokens_json,
                            entry.path,
                            nextValue,
                          ),
                        }),
                      )
                    }
                    onDelete={() =>
                      updateDetail(
                        updateContent(detail, {
                          typography_tokens_json: deleteJsonPathEntry(
                            detail.content.typography_tokens_json,
                            entry.path,
                          ),
                        }),
                      )
                    }
                  />
                ))
              )}
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() =>
                updateDetail(
                  updateContent(detail, {
                    typography_tokens_json: setJsonPathEntry(
                      detail.content.typography_tokens_json,
                      `role${typographyEntries.length + 1}.family`,
                      "Inter, system-ui, sans-serif",
                    ),
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add Type Token
            </Button>
            <EditorBlock
              className="mt-4"
              label="Typography JSON"
              value={detail.content.typography_tokens_json}
              onChange={(value) =>
                updateDetail(
                  updateContent(detail, { typography_tokens_json: value }),
                )
              }
            />
          </Panel>

          <Panel title="Component Library" icon={<Box className="h-4 w-4" />}>
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                value={componentSearch}
                placeholder="Search components, states, variants..."
                onChange={(event) => setComponentSearch(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {componentFrameworks.map((framework) => (
                  <Button
                    key={framework}
                    size="sm"
                    variant={
                      frameworkFilter === framework ? "default" : "outline"
                    }
                    onClick={() => setFrameworkFilter(framework)}
                  >
                    {framework}
                  </Button>
                ))}
              </div>
            </div>
            {componentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No component documents registered.
              </p>
            ) : filteredComponentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No components match the current filter.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredComponentDocs.map((component) => (
                  <ComponentGalleryCard
                    key={component.name}
                    component={component}
                    onOpen={() => setSelectedComponentName(component.name)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <EditorBlock
            label="Guidelines Markdown"
            value={detail.content.guidelines_markdown}
            onChange={(value) =>
              updateDetail(
                updateContent(detail, { guidelines_markdown: value }),
              )
            }
          />
          <EditorBlock
            label="Skill Markdown"
            value={detail.content.skill_markdown}
            onChange={(value) =>
              updateDetail(updateContent(detail, { skill_markdown: value }))
            }
          />
          <EditorBlock
            label="Export Preview"
            value={exportContent}
            onChange={setExportContent}
          />
        </section>

        <aside className="space-y-4">
          <VersionHistoryPanel
            activeVersionId={versionSummary?.active_version_id ?? null}
            currentId={detail.id}
            versions={versionSummary?.versions ?? []}
            onActivate={activateVersion}
            onCompare={compareVersion}
            onOpen={(versionId) => router.push(`/design-systems/${versionId}`)}
          />

          <Panel title="Asset Manifest">
            <div className="space-y-2">
              {detail.assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets.</p>
              ) : (
                detail.assets.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{item.filename}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.kind} - {item.mime_type} - {item.size_bytes} bytes
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Component Asset Sources" icon={<Layers className="h-4 w-4" />}>
            <div className="space-y-3">
              {detail.assets
                .filter((item) =>
                  /tsx|jsx|html|css|markdown|md/i.test(
                    `${item.filename} ${item.mime_type}`,
                  ),
                )
                .map((item) => (
                  <AssetSource key={item.id} asset={item} />
                ))}
            </div>
          </Panel>
        </aside>
      </div>
      {selectedComponent ? (
        <ComponentDetailDialog
          component={selectedComponent}
          onClose={() => setSelectedComponentName(null)}
        />
      ) : null}
    </main>
  );
}

function formatVersionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VersionHistoryPanel({
  versions,
  activeVersionId,
  currentId,
  onActivate,
  onCompare,
  onOpen,
}: {
  versions: DesignSystemVersionItem[];
  activeVersionId: number | null;
  currentId: number;
  onActivate: (versionId: number) => void;
  onCompare: (versionId: number) => void;
  onOpen: (versionId: number) => void;
}) {
  return (
    <Panel title="Version History" icon={<History className="h-4 w-4" />}>
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No version history.</p>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => {
            const isActive = version.id === activeVersionId;
            const isCurrent = version.id === currentId;
            return (
              <div
                key={version.id}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="truncate text-left text-sm font-semibold hover:underline"
                        type="button"
                        onClick={() => onOpen(version.id)}
                      >
                        v{version.version}
                      </button>
                      {isActive ? <Badge variant="success">Active</Badge> : null}
                      {isCurrent ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {version.status} · {formatVersionDate(version.updated_at)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCompare(version.id)}
                    disabled={!activeVersionId || isActive}
                  >
                    <GitCompare className="h-4 w-4" />
                    Diff
                  </Button>
                  <Button
                    size="sm"
                    variant={isActive ? "outline" : "default"}
                    onClick={() => onActivate(version.id)}
                    disabled={isActive}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Activate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function PaletteMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border px-3 py-2 sm:border-r sm:last:border-r-0">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ColorToken({
  name,
  value,
  onRename,
  onChange,
  onDelete,
}: {
  name: string;
  value: string;
  onRename: (name: string) => void;
  onChange: (value: string) => void;
  onDelete: () => void;
}) {
  const colorValue = isHexColor(value) ? value : "#999999";
  return (
    <div className="grid grid-cols-[44px_1fr_auto] gap-3 rounded-lg border border-border p-3">
      <input
        aria-label={`${name} color`}
        className="h-11 w-11 cursor-pointer rounded-md border border-border bg-transparent p-1"
        type="color"
        value={colorValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="min-w-0 space-y-2">
        <Input value={name} onChange={(event) => onRename(event.target.value)} />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TypographyToken({
  name,
  value,
  onRename,
  onChange,
  onDelete,
}: {
  name: string;
  value: string;
  onRename: (name: string) => void;
  onChange: (value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={name} onChange={(event) => onRename(event.target.value)} />
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Input
        className="mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
        <p
          className="truncate text-xl"
          style={{
            fontFamily: /family|font|body|heading|display|mono/i.test(name)
              ? value
              : undefined,
            fontSize: /size/i.test(name) ? value : undefined,
            fontWeight: /weight/i.test(name) ? value : undefined,
            lineHeight: /line/i.test(name) ? value : undefined,
          }}
        >
          Agentic AI Workshop
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {name} = {value}
        </p>
      </div>
    </div>
  );
}

function ComponentGalleryCard({
  component,
  onOpen,
}: {
  component: ComponentDoc;
  onOpen: () => void;
}) {
  const previewHtml = componentPreviewHtml(component);
  const chipCount = component.classes.length + component.variants.length;
  const missingStates = missingComponentStates(component);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex min-h-24 items-start justify-between gap-3 border-b border-border bg-muted/35 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{component.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {component.description || "No description recorded."}
          </p>
        </div>
        <Badge variant="outline">{component.framework}</Badge>
        {missingStates.length > 0 ? (
          <Badge variant="warning">{missingStates.length} states missing</Badge>
        ) : (
          <Badge variant="success">states ready</Badge>
        )}
      </div>

      {previewHtml ? (
        <iframe
          className="h-44 w-full border-0 bg-white"
          sandbox=""
          srcDoc={previewHtml}
          title={`${component.name} preview`}
        />
      ) : (
        <div className="flex h-44 items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          Static preview not registered.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">
            {component.styleSystem || "Design tokens"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {component.props.length} props · {component.states.length} states ·{" "}
            {component.install.length} install · {chipCount} tags
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpen}>
          <Info className="h-4 w-4" />
          Details
        </Button>
      </div>
    </article>
  );
}

function ComponentDetailDialog({
  component,
  onClose,
}: {
  component: ComponentDoc;
  onClose: () => void;
}) {
  const previewHtml = componentPreviewHtml(component);
  const rawRows = componentRawRows(component);
  const missingStates = missingComponentStates(component);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{component.name}</h2>
              <Badge variant="outline">{component.framework}</Badge>
              {component.styleSystem ? (
                <Badge variant="secondary">{component.styleSystem}</Badge>
              ) : null}
              {missingStates.length > 0 ? (
                <Badge variant="warning">
                  Missing {missingStates.length} states
                </Badge>
              ) : (
                <Badge variant="success">State coverage ready</Badge>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {component.description || "No description recorded."}
            </p>
          </div>
          <Button
            aria-label="Close component details"
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <aside className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r">
            {previewHtml ? (
              <iframe
                className="h-72 w-full rounded-md border border-border bg-white"
                sandbox=""
                srcDoc={previewHtml}
                title={`${component.name} preview`}
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
                Static preview not registered.
              </div>
            )}

            <DetailSection title="Variants">
              <ChipList items={component.variants} empty="No variants." />
            </DetailSection>
            <DetailSection title="States">
              <ChipList items={component.states} empty="No states." />
              {missingStates.length > 0 ? (
                <p className="mt-2 text-xs text-warning">
                  Missing: {missingStates.join(", ")}
                </p>
              ) : null}
            </DetailSection>
            <DetailSection title="Tailwind Classes">
              <ChipList items={component.classes} empty="No classes." />
            </DetailSection>
            <DetailSection title="Linked Assets">
              <ChipList items={component.sourceAssets} empty="No assets." />
            </DetailSection>
          </aside>

          <section className="space-y-5 p-5">
            {component.props.length > 0 ? (
              <DetailSection title="Props">
                <div className="overflow-hidden rounded-md border border-border">
                  {component.props.map((prop, index) => (
                    <div
                      key={`${String(prop.name ?? index)}-${index}`}
                      className="grid grid-cols-[minmax(110px,1fr)_minmax(90px,1fr)_2fr] gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0"
                    >
                      <code>{String(prop.name ?? "-")}</code>
                      <span className="text-muted-foreground">
                        {String(prop.type ?? "-")}
                      </span>
                      <span>
                        {String(prop.description ?? prop.default ?? "-")}
                      </span>
                    </div>
                  ))}
                </div>
              </DetailSection>
            ) : null}

            {component.dependencies.length > 0 ||
            component.install.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <DetailSection title="Dependencies">
                  <CodeList items={component.dependencies} empty="No dependencies." />
                </DetailSection>
                <DetailSection title="Install">
                  <CodeList items={component.install} empty="No install commands." />
                </DetailSection>
              </div>
            ) : null}

            {component.usage ? (
              <DetailSection title="Usage">
                <p className="text-sm leading-6">{component.usage}</p>
              </DetailSection>
            ) : null}

            {component.react ? (
              <CodeBlock label="React" language="tsx" value={component.react} />
            ) : null}
            {component.html ? (
              <CodeBlock label="HTML" language="html" value={component.html} />
            ) : null}
            {component.css ? (
              <CodeBlock label="CSS" language="css" value={component.css} />
            ) : null}
            {Object.keys(component.tailwind).length > 0 ? (
              <CodeBlock
                label="Tailwind"
                language="json"
                value={stringifyJson(component.tailwind)}
              />
            ) : null}
            {Object.keys(component.shadcn).length > 0 ? (
              <CodeBlock
                label="shadcn/ui"
                language="json"
                value={stringifyJson(component.shadcn)}
              />
            ) : null}
            {rawRows.length > 0 ? (
              <CodeBlock
                label="Token Details"
                language="json"
                value={stringifyJson(Object.fromEntries(rawRows))}
              />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function ChipList({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function CodeList({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <code key={item} className="block rounded-md bg-muted/50 px-2 py-1 text-xs">
          {item}
        </code>
      ))}
    </div>
  );
}

function CodeBlock({
  label,
  language,
  value,
}: {
  label: string;
  language: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <details className="rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5" />
          {label}
        </span>
        <Button
          aria-label={`Copy ${label}`}
          size="icon"
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void copyValue();
          }}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </summary>
      <pre className="max-h-56 overflow-auto border-t border-border bg-muted/30 p-3 text-xs">
        <code className={`language-${language}`}>{value}</code>
      </pre>
    </details>
  );
}

function AssetSource({
  asset,
}: {
  asset: DesignSystemDetail["assets"][number];
}) {
  return (
    <details className="rounded-md border border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">{asset.filename}</summary>
      <div className="mt-1 text-xs text-muted-foreground">
        {asset.kind} - {asset.mime_type} - {asset.size_bytes} bytes
      </div>
      {asset.content_text ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
          <code>{asset.content_text}</code>
        </pre>
      ) : null}
    </details>
  );
}

function EditorBlock({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <label className="text-sm font-semibold">{label}</label>
      <Textarea
        className="mt-3 min-h-48 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
