"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useState } from "react";
import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type PackageAnalysis = {
  summary: PackageSummary & { slug: string | null };
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
    score: number;
    reasons: string[];
  }>;
  recommended_mode: ImportMode;
  suggested_target_design_system_id: number | null;
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("create");
  const [importFileName, setImportFileName] = useState("");
  const [importPackage, setImportPackage] = useState<unknown>(null);
  const [importAnalysis, setImportAnalysis] = useState<PackageAnalysis | null>(
    null,
  );
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
      setImportFileName(file.name);
      setImportPackage(parsed);

      try {
        const res = await fetch("/api/design-systems/import/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package: parsed }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Failed to analyze package");
        }
        const analysis = json.data as PackageAnalysis;
        const summary = {
          ...analysis.summary,
          slug: analysis.summary.slug || slugify(analysis.summary.title),
        };
        setImportAnalysis(analysis);
        setImportForm(summary);
        setImportMode(analysis.recommended_mode);
        setImportMessage(
          analysis.recommended_mode === "version"
            ? "Related design system found. Importing as a new version is recommended."
            : "No close match found. Importing as a new design system is recommended.",
        );
        setImportTargetId(
          analysis.suggested_target_design_system_id
            ? String(analysis.suggested_target_design_system_id)
            : String(data[0]?.id ?? ""),
        );
      } catch (error) {
        const summary = packageSummary(parsed);
        setImportAnalysis(null);
        setImportForm(summary);
        setImportMessage(
          error instanceof Error
            ? error.message
            : "Package analysis failed. Review the imported metadata.",
        );
        setImportTargetId((current) => current || String(data[0]?.id ?? ""));
      }
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
      setImportAnalysis(null);
      setImportFileName("");
      setImportMessage("Imported package");
      setImportDialogOpen(false);
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
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <PackageOpen className="h-4 w-4" />
              Import Package
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[44rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5" />
              Import Package
            </DialogTitle>
            <DialogDescription>
              Load a BlueKiwi package export from another server or marketplace
              as a new system or version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
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

                {importAnalysis ? (
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="font-semibold text-foreground">
                          {importAnalysis.counts.colors}
                        </div>
                        Colors
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {importAnalysis.counts.typography}
                        </div>
                        Type
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {importAnalysis.counts.components}
                        </div>
                        Components
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {importAnalysis.counts.assets}
                        </div>
                        Assets
                      </div>
                    </div>
                    {importAnalysis.related_systems.length > 0 ? (
                      <div className="mt-3 space-y-1 border-t border-border pt-2">
                        <p className="font-medium text-foreground">
                          Editable related systems
                        </p>
                        {importAnalysis.related_systems
                          .slice(0, 3)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="block w-full rounded-md px-2 py-1 text-left hover:bg-muted"
                              type="button"
                              onClick={() => {
                                setImportMode("version");
                                setImportTargetId(String(item.id));
                              }}
                            >
                              {item.title} · v{item.version} ·{" "}
                              {item.reasons.join(", ")}
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
          </div>

          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              disabled={!importPackage || importing}
              onClick={importDesignSystemPackage}
            >
              <Upload className="h-4 w-4" />
              Import Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-6">
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
              description="Import a package or use /bk-design with MCP to create registry items for agents."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.map((item) => (
                <Link
                  key={item.id}
                  href={`/design-systems/${item.id}`}
                  aria-label={`Open ${item.title}`}
                  className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <Card className="h-full rounded-lg transition-colors hover:border-primary/50 hover:bg-muted/20">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{item.title}</div>
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
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        <Badge variant="secondary">{item.category}</Badge>
                        <Badge variant="neutral">{item.surface}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
