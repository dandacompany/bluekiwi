"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FilePlus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DesignSystemDetail {
  id: number;
  title: string;
  slug: string;
  description: string;
  version: string;
  status: string;
  content: {
    schema_json: string;
    tokens_json: string;
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
  }>;
}

export default function DesignSystemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<DesignSystemDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [asset, setAsset] = useState({
    kind: "reference",
    filename: "",
    mime_type: "text/markdown",
    content_text: "",
  });

  useEffect(() => {
    void load();
    async function load() {
      const res = await fetch(`/api/design-systems/${id}`);
      const json = await res.json();
      setDetail(json.data ?? null);
    }
  }, [id]);

  async function save() {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/design-systems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detail.title,
          slug: detail.slug,
          description: detail.description,
          schema: JSON.parse(detail.content.schema_json || "{}"),
          tokens: JSON.parse(detail.content.tokens_json || "{}"),
          guidelines_markdown: detail.content.guidelines_markdown,
          skill_markdown: detail.content.skill_markdown,
          export_manifest: JSON.parse(
            detail.content.export_manifest_json || "{}",
          ),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed");
      setDetail(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function addAsset() {
    const res = await fetch(`/api/design-systems/${id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asset),
    });
    if (!res.ok) return;
    const refreshed = await fetch(`/api/design-systems/${id}`).then((r) =>
      r.json(),
    );
    setDetail(refreshed.data ?? null);
    setAsset({
      kind: "reference",
      filename: "",
      mime_type: "text/markdown",
      content_text: "",
    });
  }

  async function exportAs(format: "json" | "skill") {
    const res = await fetch(`/api/design-systems/${id}/export?format=${format}`);
    const json = await res.json();
    setExportContent(
      format === "skill"
        ? json.data?.content ?? ""
        : JSON.stringify(json.data ?? {}, null, 2),
    );
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
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{detail.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportAs("json")}>
              <Download className="h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" onClick={() => exportAs("skill")}>
              <Download className="h-4 w-4" />
              Skill
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
            <Input
              value={detail.title}
              onChange={(event) =>
                setDetail({ ...detail, title: event.target.value })
              }
            />
            <Input
              value={detail.slug}
              onChange={(event) =>
                setDetail({ ...detail, slug: event.target.value })
              }
            />
            <Textarea
              className="md:col-span-2"
              value={detail.description}
              onChange={(event) =>
                setDetail({ ...detail, description: event.target.value })
              }
            />
          </div>

          <EditorBlock
            label="Tokens JSON"
            value={detail.content.tokens_json}
            onChange={(value) =>
              setDetail({
                ...detail,
                content: { ...detail.content, tokens_json: value },
              })
            }
          />
          <EditorBlock
            label="Guidelines Markdown"
            value={detail.content.guidelines_markdown}
            onChange={(value) =>
              setDetail({
                ...detail,
                content: { ...detail.content, guidelines_markdown: value },
              })
            }
          />
          <EditorBlock
            label="Skill Markdown"
            value={detail.content.skill_markdown}
            onChange={(value) =>
              setDetail({
                ...detail,
                content: { ...detail.content, skill_markdown: value },
              })
            }
          />
          <EditorBlock
            label="Export Preview"
            value={exportContent}
            onChange={setExportContent}
          />
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Assets</h2>
            <div className="mt-3 space-y-2">
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
                      {item.kind} · {item.mime_type} · {item.size_bytes} bytes
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Add Text Asset</h2>
            <div className="mt-3 space-y-3">
              <Input
                placeholder="reference.md"
                value={asset.filename}
                onChange={(event) =>
                  setAsset({ ...asset, filename: event.target.value })
                }
              />
              <Input
                placeholder="text/markdown"
                value={asset.mime_type}
                onChange={(event) =>
                  setAsset({ ...asset, mime_type: event.target.value })
                }
              />
              <Textarea
                className="min-h-32"
                value={asset.content_text}
                onChange={(event) =>
                  setAsset({ ...asset, content_text: event.target.value })
                }
              />
              <Button
                className="w-full"
                onClick={addAsset}
                disabled={!asset.filename.trim()}
              >
                <FilePlus className="h-4 w-4" />
                Add Asset
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function EditorBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <label className="text-sm font-semibold">{label}</label>
      <Textarea
        className="mt-3 min-h-48 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
