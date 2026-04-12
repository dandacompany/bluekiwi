"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { CommandDialog } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useTranslation } from "@/lib/i18n/context";
import { useListFetch } from "@/lib/use-list-fetch";
import { useDeleteHandler } from "@/lib/use-delete-handler";

const BlocknoteEditor = dynamic(
  () => import("@/components/shared/blocknote-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[22rem] rounded-[1.25rem] border border-border bg-brand-surface-soft/55 animate-pulse" />
    ),
  },
);

interface Instruction {
  id: number;
  title: string;
  content: string;
  agent_type: string;
  tags: string;
  priority: number;
  is_active: number;
  owner_id?: number;
  visibility_override?: "personal" | null;
  created_at: string;
  updated_at: string;
}

const AGENT_TYPES = [
  "general",
  "coding",
  "research",
  "writing",
  "data",
] as const;

function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, "");
}

function buildInstructionPreviewMarkdown(content: string) {
  const lines = content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return "";

  const preview = lines.slice(0, 4).join("\n");
  return lines.length > 4 ? `${preview}\n\n...` : preview;
}

function formatInstructionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const markdownPreviewClass =
  "prose prose-sm max-w-none text-[var(--muted-foreground)] prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 prose-headings:text-sm prose-headings:font-semibold prose-strong:text-[var(--foreground)] prose-code:rounded prose-code:bg-brand-surface-soft prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-pre:rounded-2xl prose-pre:border prose-pre:border-border prose-pre:bg-brand-surface-soft prose-pre:text-[var(--foreground)]";

export default function InstructionsPage() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Instruction | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTag, setDraftTag] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [form, setForm] = useState({
    title: "",
    content: "",
    agent_type: "general",
    tags: [] as string[],
    priority: 0,
  });
  const [search, setSearch] = useState("");

  const {
    data: instructions,
    loading,
    refetch: fetchAll,
  } = useListFetch<Instruction>(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    return `/api/instructions?${params}`;
  }, [search]);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<Instruction>({
      endpoint: (target) => `/api/instructions/${target.id}`,
      onSuccess: fetchAll,
      fallbackMessage: t("common.deleteFailed"),
    });

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      agent_type: "general",
      tags: [],
      priority: 0,
    });
    setEditing(null);
    setDraftTag("");
    setEditorKey((k) => k + 1);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    resetForm();
  };

  const openCreateDialog = () => {
    resetForm();
    setEditorOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title,
      content: form.content,
      agent_type: form.agent_type,
      tags: form.tags,
      priority: form.priority,
    };

    if (editing) {
      await fetch(`/api/instructions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    closeEditor();
    fetchAll();
  };

  const handleEdit = (inst: Instruction) => {
    const tags = JSON.parse(inst.tags || "[]") as string[];
    setEditing(inst);
    setForm({
      title: inst.title,
      content: inst.content,
      agent_type: inst.agent_type,
      tags,
      priority: inst.priority,
    });
    setDraftTag("");
    setEditorOpen(true);
  };

  const handleToggle = async (inst: Instruction) => {
    await fetch(`/api/instructions/${inst.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !inst.is_active }),
    });
    fetchAll();
  };

  const addTag = (rawValue: string) => {
    const tag = normalizeTag(rawValue);
    if (!tag) return;

    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags : [...current.tags, tag],
    }));
    setDraftTag("");
  };

  const removeTag = (tagToRemove: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("instructionsPage.title")}
            </h1>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            {t("instructionsPage.newInstruction")}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-7xl w-full px-6 py-6">
        {/* Search */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder={t("instructionsPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <CommandDialog
          open={editorOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeEditor();
              return;
            }
            setEditorOpen(true);
          }}
          title={
            editing
              ? t("instructionsPage.editInstruction")
              : t("instructionsPage.createInstruction")
          }
          description={t("instructionsPage.dialogDescription")}
          className="w-[min(72rem,calc(100vw-2rem))] max-w-none rounded-[1.75rem] border border-border/70 bg-background/95 p-0 shadow-[0_24px_80px_rgba(20,39,86,0.22)] sm:max-w-[72rem]"
        >
          <div className="border-b border-border/70 bg-kiwi-100/50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">
                  {editing
                    ? editing.title
                    : t("instructionsPage.newAgentInstruction")}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid gap-4">
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder={t("instructionsPage.titlePlaceholder")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="flex-1"
                  required
                />
                <Select
                  value={form.agent_type}
                  onValueChange={(value) =>
                    setForm({ ...form, agent_type: value })
                  }
                >
                  <SelectTrigger className="w-40 bg-background">
                    <SelectValue placeholder={t("instructionsPage.title")} />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {AGENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <BlocknoteEditor
                key={editorKey}
                initialContent={form.content}
                onChange={(md) => setForm((f) => ({ ...f, content: md }))}
              />
              <div className="flex gap-3">
                <div className="flex-1 rounded-[1.25rem] border border-input bg-background px-3 py-2 shadow-none transition-colors focus-within:border-brand-blue-500 focus-within:ring-[4px] focus-within:ring-ring/35">
                  <div className="flex flex-wrap items-center gap-2">
                    {form.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="default"
                        className="gap-1.5 pr-1"
                      >
                        #{tag}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-black/5 hover:text-foreground"
                          onClick={() => removeTag(tag)}
                          aria-label={t("instructionsPage.tagRemove").replace(
                            "{tag}",
                            tag,
                          )}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      type="text"
                      value={draftTag}
                      onChange={(e) => setDraftTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(draftTag);
                        } else if (
                          e.key === "Backspace" &&
                          draftTag.length === 0 &&
                          form.tags.length > 0
                        ) {
                          removeTag(form.tags[form.tags.length - 1]);
                        }
                      }}
                      onBlur={() => addTag(draftTag)}
                      placeholder={
                        form.tags.length === 0
                          ? t("instructionsPage.tagInputPlaceholder")
                          : t("instructionsPage.tagAddPlaceholder")
                      }
                      className="min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-ink-500"
                    />
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder={t("instructionsPage.priorityPlaceholder")}
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                  className="w-28"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("instructionsPage.helperText")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeEditor}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit">
                    {editing ? t("common.save") : t("common.add")}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CommandDialog>

        <DeleteConfirmDialog
          target={deleteTarget}
          title={t("instructionsPage.deleteTitle")}
          description={t("instructionsPage.deleteDescription").replace(
            "{title}",
            deleteTarget?.title ?? t("instructionsPage.title"),
          )}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />

        {/* List */}
        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("common.loading")}
            </CardContent>
          </Card>
        ) : instructions.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("instructionsPage.emptyTitle")}
            description={t("instructionsPage.emptyDescription")}
          />
        ) : (
          <div className="space-y-3">
            {instructions.map((inst) => {
              const tags = JSON.parse(inst.tags || "[]") as string[];
              const previewMarkdown = buildInstructionPreviewMarkdown(
                inst.content,
              );
              return (
                <Card
                  key={inst.id}
                  className={`cursor-pointer transition-shadow hover:shadow-soft ${
                    inst.is_active ? "" : "opacity-60"
                  }`}
                  onClick={() => handleEdit(inst)}
                >
                  <CardContent className="p-4">
                    <div className="-mx-4 -mt-4 mb-3 rounded-t-[1.35rem] border-b border-border bg-kiwi-100/50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {inst.title}
                            </p>
                            <Badge>{inst.agent_type}</Badge>
                            {inst.priority > 0 && (
                              <Badge variant="warning">P{inst.priority}</Badge>
                            )}
                            {!inst.is_active && (
                              <Badge variant="neutral">
                                {t("instructionsPage.inactive")}
                              </Badge>
                            )}
                            <VisibilityBadge
                              visibility={inst.visibility_override ?? "inherit"}
                              iconOnly
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                aria-label={t("instructionsPage.actionMenu", {
                                  title: inst.title,
                                })}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={() => handleEdit(inst)}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggle(inst)}
                              >
                                <Power className="mr-2 h-3.5 w-3.5" />
                                {inst.is_active
                                  ? t("instructionsPage.toggleDisable")
                                  : t("instructionsPage.toggleEnable")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(inst)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {t("common.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="default"
                            className="px-2 py-0.5"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 max-h-28 overflow-hidden rounded-[1rem] border border-border/70 bg-brand-surface-soft/45 px-3 py-2">
                      <div className={markdownPreviewClass}>
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {previewMarkdown || t("instructionsPage.noPreview")}
                        </Markdown>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
