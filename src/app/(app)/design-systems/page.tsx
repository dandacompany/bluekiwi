"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useState } from "react";
import {
  FileJson,
  GitBranch,
  PackageOpen,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { useListFetch } from "@/lib/use-list-fetch";

interface DesignSystem {
  id: number;
  title: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  surface: string;
  status: string;
  is_active: boolean;
  updated_at: string;
}

type ImportMode = "create" | "version";

type PackageSummary = {
  title: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  surface: string;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function packageSummary(raw: unknown): PackageSummary {
  const pkg = recordValue(raw);
  const manifest = recordValue(pkg.package_manifest);
  const designSystem = {
    ...recordValue(manifest.design_system),
    ...recordValue(pkg.design_system),
  };
  const title =
    stringValue(designSystem.title) ||
    stringValue(pkg.title) ||
    "Imported Design System";
  const slug = stringValue(designSystem.slug) || slugify(title);
  return {
    title,
    slug,
    description:
      stringValue(designSystem.description) ||
      stringValue(pkg.description) ||
      `Imported BlueKiwi design package for ${title}.`,
    version: stringValue(designSystem.version) || "1.0.0",
    category: stringValue(designSystem.category) || "Imported",
    surface: stringValue(designSystem.surface) || "web",
  };
}

export default function DesignSystemsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("create");
  const [importFileName, setImportFileName] = useState("");
  const [importPackage, setImportPackage] = useState<unknown>(null);
  const [importTargetId, setImportTargetId] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importForm, setImportForm] = useState<PackageSummary>({
    title: "",
    slug: "",
    description: "",
    version: "",
    category: "Imported",
    surface: "web",
  });
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "Custom",
    surface: "web",
    tokens: "{\n  \"color\": {},\n  \"typography\": {},\n  \"components\": {}\n}",
    guidelines_markdown: "## Principles\n\n",
    skill_markdown:
      "Use this design system when creating or editing visual materials.",
  });

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return `/api/design-systems${suffix}`;
  }, [search]);

  const { data, loading, refetch } = useListFetch<DesignSystem>(url, [url]);

  async function loadPackageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const summary = packageSummary(parsed);
      setImportPackage(parsed);
      setImportFileName(file.name);
      setImportForm(summary);
      setImportMessage("");
      setImportTargetId((current) => current || String(data[0]?.id ?? ""));
    } catch {
      setImportMessage("Choose a valid BlueKiwi design package JSON file.");
    } finally {
      event.target.value = "";
    }
  }

  async function importDesignSystemPackage() {
    if (!importPackage) {
      setImportMessage("Choose a package JSON file first.");
      return;
    }
    if (importMode === "version" && !importTargetId) {
      setImportMessage("Choose a target design system for the new version.");
      return;
    }

    setImporting(true);
    setImportMessage("");
    try {
      const body =
        importMode === "version"
          ? {
              mode: "version",
              target_design_system_id: Number(importTargetId),
              version: importForm.version || undefined,
              package: importPackage,
            }
          : {
              mode: "create",
              title: importForm.title,
              slug: importForm.slug || undefined,
              description: importForm.description,
              version: importForm.version || undefined,
              category: importForm.category,
              surface: importForm.surface,
              package: importPackage,
            };
      const res = await fetch("/api/design-systems/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to import package");
      }
      const importedId = json?.data?.design_system?.id;
      await refetch();
      setImportPackage(null);
      setImportFileName("");
      setImportMessage("Imported package");
      if (typeof importedId === "number") {
        router.push(`/design-systems/${importedId}`);
      }
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "Failed to import package",
      );
    } finally {
      setImporting(false);
    }
  }

  async function createDesignSystem() {
    setCreating(true);
    try {
      const res = await fetch("/api/design-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug || undefined,
          description: form.description,
          category: form.category,
          surface: form.surface,
          tokens: JSON.parse(form.tokens || "{}"),
          guidelines_markdown: form.guidelines_markdown,
          skill_markdown: form.skill_markdown,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to create");
      }
      setForm((prev) => ({ ...prev, title: "", slug: "", description: "" }));
      await refetch();
    } finally {
      setCreating(false);
    }
  }

  async function seedDesignSystems() {
    setSeeding(true);
    try {
      const res = await fetch("/api/design-systems/seed", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to seed");
      }
      await refetch();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Design Systems
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Versioned design-system registry for BlueKiwi MCP and skills.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={seedDesignSystems} disabled={seeding}>
              <Palette className="h-4 w-4" />
              Seed Library
            </Button>
            <Button onClick={createDesignSystem} disabled={creating || !form.title.trim()}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-6 xl:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">New Design System</h2>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
              <Input
                placeholder="slug-optional"
                value={form.slug}
                onChange={(event) =>
                  setForm({ ...form, slug: event.target.value })
                }
              />
              <Textarea
                placeholder="Description"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Category"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                />
                <Input
                  placeholder="surface: web, slides, docs..."
                  value={form.surface}
                  onChange={(event) =>
                    setForm({ ...form, surface: event.target.value })
                  }
                />
              </div>
              <Textarea
                className="min-h-32 font-mono text-xs"
                value={form.tokens}
                onChange={(event) =>
                  setForm({ ...form, tokens: event.target.value })
                }
              />
              <Textarea
                className="min-h-28"
                value={form.guidelines_markdown}
                onChange={(event) =>
                  setForm({
                    ...form,
                    guidelines_markdown: event.target.value,
                  })
                }
              />
              <Textarea
                className="min-h-28"
                value={form.skill_markdown}
                onChange={(event) =>
                  setForm({ ...form, skill_markdown: event.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Import Package</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Load a BlueKiwi package export as a new system or version.
                </p>
              </div>
              <PackageOpen className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <Upload className="h-4 w-4" />
                {importFileName || "Choose design-package JSON"}
                <input
                  accept="application/json,.json"
                  className="sr-only"
                  type="file"
                  onChange={loadPackageFile}
                />
              </label>

              {importPackage ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={importMode === "create" ? "default" : "outline"}
                      onClick={() => setImportMode("create")}
                    >
                      <Plus className="h-4 w-4" />
                      New
                    </Button>
                    <Button
                      type="button"
                      variant={importMode === "version" ? "default" : "outline"}
                      onClick={() => {
                        setImportMode("version");
                        setImportTargetId(
                          (current) => current || String(data[0]?.id ?? ""),
                        );
                      }}
                    >
                      <GitBranch className="h-4 w-4" />
                      Version
                    </Button>
                  </div>

                  {importMode === "version" ? (
                    <Select
                      value={importTargetId}
                      onValueChange={setImportTargetId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Target design system" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.title} · v{item.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  <Input
                    placeholder="Title"
                    value={importForm.title}
                    disabled={importMode === "version"}
                    onChange={(event) =>
                      setImportForm({
                        ...importForm,
                        title: event.target.value,
                        slug: importForm.slug || slugify(event.target.value),
                      })
                    }
                  />
                  <Input
                    placeholder="slug"
                    value={importForm.slug}
                    disabled={importMode === "version"}
                    onChange={(event) =>
                      setImportForm({ ...importForm, slug: event.target.value })
                    }
                  />
                  <Textarea
                    className="min-h-20"
                    placeholder="Description"
                    value={importForm.description}
                    disabled={importMode === "version"}
                    onChange={(event) =>
                      setImportForm({
                        ...importForm,
                        description: event.target.value,
                      })
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder="Version"
                      value={importForm.version}
                      onChange={(event) =>
                        setImportForm({
                          ...importForm,
                          version: event.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Category"
                      value={importForm.category}
                      disabled={importMode === "version"}
                      onChange={(event) =>
                        setImportForm({
                          ...importForm,
                          category: event.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Surface"
                      value={importForm.surface}
                      disabled={importMode === "version"}
                      onChange={(event) =>
                        setImportForm({
                          ...importForm,
                          surface: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}

              {importMessage ? (
                <p className="text-xs text-muted-foreground">{importMessage}</p>
              ) : null}

              <Button
                className="w-full"
                disabled={!importPackage || importing}
                onClick={importDesignSystemPackage}
              >
                <Upload className="h-4 w-4" />
                Import Package
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search design systems..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-border p-8 text-sm text-muted-foreground">
              Loading design systems...
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Palette}
              title="No design systems"
              description="Create a registry item to make design rules available to MCP tools and skills."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.map((item) => (
                <Card key={item.id} className="rounded-lg">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/design-systems/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.slug}
                        </p>
                      </div>
                      <Badge variant={item.is_active ? "success" : "neutral"}>
                        v{item.version}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {item.description || "No description"}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        <Badge variant="secondary">{item.category}</Badge>
                        <Badge variant="neutral">{item.surface}</Badge>
                      </div>
                      <Link
                        href={`/design-systems/${item.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
