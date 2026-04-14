"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  Upload,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { WorkflowVisibilityDialog } from "@/components/workflows/workflow-visibility-dialog";
import { WorkflowTransferDialog } from "@/components/workflows/workflow-transfer-dialog";
import { FolderTree, type FolderItem } from "@/components/folders/folder-tree";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";
import { useListFetch } from "@/lib/use-list-fetch";
import { useDeleteHandler } from "@/lib/use-delete-handler";

const PAGE_SIZE = 10;

interface WorkflowNodeItem {
  id: number;
  step_order: number;
  node_type: string;
  title: string;
  instruction_id: number | null;
  resolved_instruction: string;
}

interface WorkflowItem {
  id: number;
  title: string;
  description: string;
  nodes: WorkflowNodeItem[];
  created_at: string;
  owner_id?: number;
  folder_id?: number;
  visibility_override?: "personal" | null;
}

function NodeBadge({ node }: { node: WorkflowNodeItem }) {
  const nt = node.node_type as "action" | "gate" | "loop";
  const config =
    nt === "gate"
      ? {
          Icon: MessageSquare,
          className: "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700",
        }
      : nt === "loop"
        ? {
            Icon: Repeat,
            className:
              "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
          }
        : {
            Icon: Zap,
            className:
              "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
          };

  return (
    <Badge className={config.className}>
      <config.Icon className="h-3 w-3" />
      <span className="truncate text-[11px]">{node.title}</span>
    </Badge>
  );
}

function NodePipeline({ nodes }: { nodes: WorkflowNodeItem[] }) {
  const MAX_VISIBLE = 5;
  const visible = nodes.slice(0, MAX_VISIBLE);
  const remaining = nodes.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {visible.map((node, i) => (
        <div key={node.id} className="flex items-center gap-1.5">
          <NodeBadge node={node} />
          {i < visible.length - 1 && (
            <ArrowRight className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
          )}
        </div>
      ))}
      {remaining > 0 && (
        <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedFolder, setSelectedFolder] = useState<number | null>(() => {
    const fid = searchParams.get("folder_id");
    return fid ? Number(fid) : null;
  });
  const [folderList, setFolderList] = useState<FolderItem[]>([]);
  const [folderRefreshKey, setFolderRefreshKey] = useState(0);
  const [renamingHeader, setRenamingHeader] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState("");
  const headerInputRef = useRef<HTMLInputElement>(null);
  const createRootFolderRef = useRef<(() => void) | null>(null);
  const [rootCtxMenu, setRootCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    if (!rootCtxMenu) return;
    const dismiss = () => setRootCtxMenu(null);
    document.addEventListener("click", dismiss);
    document.addEventListener("contextmenu", dismiss);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("contextmenu", dismiss);
    };
  }, [rootCtxMenu]);
  const [search, setSearch] = useState("");
  const [visibilityTarget, setVisibilityTarget] = useState<{
    id: number;
    title: string;
    override: string | null;
  } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const {
    data: workflows,
    loading,
    refetch: fetchWorkflows,
  } = useListFetch<WorkflowItem>(() => {
    const params = new URLSearchParams();
    if (selectedFolder !== null)
      params.set("folder_id", String(selectedFolder));
    if (search) params.set("q", search);
    return `/api/workflows?${params}`;
  }, [selectedFolder, search]);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<WorkflowItem>({
      endpoint: (target) => `/api/workflows/${target.id}`,
      onSuccess: async () => {
        toast.success(t("workflows.deleted"));
        await fetchWorkflows();
      },
      fallbackMessage: t("common.deleteFailed"),
    });

  const totalPages = Math.max(1, Math.ceil(workflows.length / PAGE_SIZE));
  const paged = workflows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearSearch = useCallback(() => {
    setSearch("");
    setPage(1);
  }, []);

  const handleFolderSelect = useCallback((folderId: number | null) => {
    setSelectedFolder((prev) => (prev === folderId ? null : folderId));
    setPage(1);
  }, []);

  const selectedFolderItem =
    selectedFolder !== null
      ? (folderList.find((f) => f.id === selectedFolder) ?? null)
      : null;

  // Build full ancestor path for the breadcrumb (root → ... → selected)
  const selectedFolderPath = useMemo<FolderItem[]>(() => {
    if (!selectedFolderItem) return [];
    const path: FolderItem[] = [];
    let current: FolderItem | undefined = selectedFolderItem;
    const visited = new Set<number>();
    while (current) {
      if (visited.has(current.id)) break; // cycle guard
      visited.add(current.id);
      path.unshift(current);
      if (current.parent_id === null) break;
      current = folderList.find((f) => f.id === current!.parent_id);
    }
    return path;
  }, [selectedFolderItem, folderList]);

  /** Build relative folder path from selectedFolder to a workflow's folder */
  const getSubfolderPath = useCallback(
    (wfFolderId?: number): string[] => {
      if (!wfFolderId || !selectedFolder || wfFolderId === selectedFolder)
        return [];
      const names: string[] = [];
      let cur = folderList.find((f) => f.id === wfFolderId);
      const visited = new Set<number>();
      while (cur && cur.id !== selectedFolder) {
        if (visited.has(cur.id)) break;
        visited.add(cur.id);
        names.unshift(cur.is_system ? t("folders.myWorkspace") : cur.name);
        if (cur.parent_id === null) break;
        cur = folderList.find((f) => f.id === cur!.parent_id);
      }
      return names;
    },
    [selectedFolder, folderList, t],
  );

  const startHeaderRename = useCallback(() => {
    if (!selectedFolderItem || selectedFolderItem.is_system) return;
    setHeaderRenameValue(selectedFolderItem.name);
    setRenamingHeader(true);
    setTimeout(() => {
      headerInputRef.current?.focus();
      headerInputRef.current?.select();
    }, 0);
  }, [selectedFolderItem]);

  const confirmHeaderRename = useCallback(async () => {
    if (!selectedFolder || !headerRenameValue.trim()) {
      setRenamingHeader(false);
      return;
    }
    setRenamingHeader(false);
    const res = await fetch(`/api/folders/${selectedFolder}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: headerRenameValue.trim() }),
    });
    if (res.ok) {
      setFolderRefreshKey((k) => k + 1);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? t("folders.renameFailed"));
    }
  }, [selectedFolder, headerRenameValue, t]);

  const handleWorkflowDrop = useCallback(
    async (workflowId: number, folderId: number) => {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (res.ok) {
        toast.success(t("workflows.movedToFolder"));
        fetchWorkflows();
      }
    },
    [fetchWorkflows, t],
  );

  const handleDuplicate = async (wf: WorkflowItem) => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${wf.title} (${t("workflows.copy")})`,
        description: wf.description,
        nodes: wf.nodes.map((n) => ({
          title: n.title,
          node_type: n.node_type,
          instruction_id: n.instruction_id,
          instruction: n.resolved_instruction,
        })),
      }),
    });
    if (res.ok) {
      toast.success(t("workflows.duplicated"));
      fetchWorkflows();
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h1
              className={`text-2xl font-bold tracking-tight ${selectedFolder !== null ? "cursor-pointer hover:text-brand-blue-600 transition-colors" : ""}`}
              onClick={() => {
                if (selectedFolder !== null) {
                  setSelectedFolder(null);
                  setRenamingHeader(false);
                  setPage(1);
                }
              }}
            >
              {t("workflows.title")}
            </h1>
            {selectedFolderPath.map((folder, idx) => {
              const isLast = idx === selectedFolderPath.length - 1;
              const displayName = folder.is_system
                ? t("folders.myWorkspace")
                : folder.name;
              return (
                <span key={folder.id} className="flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]/50" />
                  {isLast && renamingHeader ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={headerInputRef}
                        value={headerRenameValue}
                        onChange={(e) => setHeaderRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void confirmHeaderRename();
                          if (e.key === "Escape") setRenamingHeader(false);
                        }}
                        className="h-8 rounded-[var(--radius-sm)] border border-brand-blue-400 bg-transparent px-2 text-lg font-bold outline-none ring-1 ring-brand-blue-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => void confirmHeaderRename()}
                        className="flex h-7 w-7 items-center justify-center rounded text-kiwi-600 hover:bg-kiwi-100"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingHeader(false)}
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-surface-soft"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-2xl font-bold tracking-tight select-none ${
                        !isLast
                          ? "cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                          : folder.is_system
                            ? "cursor-default"
                            : "cursor-text"
                      }`}
                      title={
                        isLast && !folder.is_system
                          ? t("folders.doubleClickToRename")
                          : undefined
                      }
                      onClick={
                        !isLast
                          ? () => {
                              setSelectedFolder(folder.id);
                              setRenamingHeader(false);
                              setPage(1);
                            }
                          : undefined
                      }
                      onDoubleClick={
                        isLast && !folder.is_system
                          ? startHeaderRename
                          : undefined
                      }
                    >
                      {displayName}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("common.search")}
                className="h-8 w-52 rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent pl-8 pr-7 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-brand-blue-400 focus:ring-1 focus:ring-brand-blue-400/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex rounded-[var(--radius)] border border-[var(--border)] p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${viewMode === "list" ? "bg-[var(--card)] shadow-sm" : ""}`}
                onClick={() => setViewMode("list")}
                title={t("common.listView")}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${viewMode === "grid" ? "bg-[var(--card)] shadow-sm" : ""}`}
                onClick={() => setViewMode("grid")}
                title={t("common.gridView")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button asChild size="sm">
              <Link
                href={
                  selectedFolder
                    ? `/workflows/new?folder_id=${selectedFolder}`
                    : "/workflows/new"
                }
              >
                <Plus className="h-4 w-4" />
                {t("workflows.newWorkflow")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              {t("workflows.import")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div className="mx-auto max-w-7xl w-full px-6 py-6">
        <div className="flex gap-6">
          {/* Left: Folder sidebar */}
          <aside className="w-52 shrink-0">
            <div className="sticky top-[56px]">
              {/* "All" entry */}
              <button
                onClick={() => handleFolderSelect(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setRootCtxMenu({ x: e.clientX, y: e.clientY });
                }}
                className={`mb-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors ${
                  selectedFolder === null
                    ? "bg-brand-blue-100 font-medium text-brand-blue-700"
                    : "text-[var(--muted-foreground)] hover:bg-surface-soft hover:text-[var(--foreground)]"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                {t("workflows.allWorkflows")}
              </button>
              <FolderTree
                selectedId={selectedFolder}
                onSelect={handleFolderSelect}
                onFoldersChange={setFolderList}
                onWorkflowDrop={handleWorkflowDrop}
                refreshKey={folderRefreshKey}
                onCreateRootRef={(fn) => {
                  createRootFolderRef.current = fn;
                }}
              />

              {/* Root context menu */}
              {rootCtxMenu && (
                <div
                  className="fixed z-50 min-w-[140px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--shadow-card)]"
                  style={{ top: rootCtxMenu.y, left: rootCtxMenu.x }}
                  onClick={() => setRootCtxMenu(null)}
                >
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-soft"
                    onClick={() => {
                      createRootFolderRef.current?.();
                      setRootCtxMenu(null);
                    }}
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    {t("folders.new")}
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Right: Workflow list */}
          <div className="min-w-0 flex-1">
            {/* Active filters indicator */}
            {(search || selectedFolder !== null) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {search && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-blue-300/50 bg-brand-blue-50 px-2.5 py-0.5 text-xs text-brand-blue-700">
                    <Search className="h-3 w-3" />
                    {search}
                    <button
                      onClick={clearSearch}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <span className="text-xs text-[var(--muted-foreground)]">
                  {workflows.length}
                  {t("workflows.results")}
                </span>
              </div>
            )}

            {loading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  {t("common.loading")}
                </CardContent>
              </Card>
            ) : workflows.length === 0 ? (
              <EmptyState
                icon={Workflow}
                title={t("workflows.empty")}
                description={t("workflows.emptyDesc")}
                actionLabel={t("workflows.newWorkflow")}
                actionHref={
                  selectedFolder
                    ? `/workflows/new?folder_id=${selectedFolder}`
                    : "/workflows/new"
                }
              />
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                      : "flex flex-col gap-2"
                  }
                >
                  {paged.map((wf) =>
                    viewMode === "list" ? (
                      /* ── List row ── */
                      <Card
                        key={wf.id}
                        className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-soft"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("workflowId", String(wf.id))
                        }
                        onClick={() => router.push(`/workflows/${wf.id}`)}
                      >
                        <CardContent className="px-4 py-3">
                          {/* Row 1: title + meta + menu */}
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold">
                                  {(() => {
                                    const path = getSubfolderPath(wf.folder_id);
                                    if (path.length === 0) return wf.title;
                                    return (
                                      <>
                                        <span className="text-xs font-normal text-[var(--muted-foreground)]/60">
                                          {path.join(" > ")}
                                          {" > "}
                                        </span>
                                        {wf.title}
                                      </>
                                    );
                                  })()}
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVisibilityTarget({
                                      id: wf.id,
                                      title: wf.title,
                                      override: wf.visibility_override ?? null,
                                    });
                                  }}
                                  className="rounded opacity-60 hover:opacity-100"
                                  title={t("visibility.settings")}
                                >
                                  <VisibilityBadge
                                    visibility={
                                      wf.visibility_override ?? "inherit"
                                    }
                                    iconOnly
                                  />
                                </button>
                              </div>
                            </div>
                            <p className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                              {new Date(wf.created_at).toLocaleDateString(
                                "ko-KR",
                              )}
                            </p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
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
                                  onClick={() =>
                                    router.push(`/workflows/${wf.id}/edit`)
                                  }
                                >
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(wf)}
                                >
                                  <Copy className="mr-2 h-3.5 w-3.5" />
                                  {t("common.duplicate")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-[var(--destructive)]"
                                  onClick={() => setDeleteTarget(wf)}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {/* Row 2: node pipeline chips */}
                          <div className="mt-2 overflow-hidden">
                            <NodePipeline nodes={wf.nodes} />
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      /* ── Grid card ── */
                      <Card
                        key={wf.id}
                        className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-soft"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("workflowId", String(wf.id))
                        }
                        onClick={() => router.push(`/workflows/${wf.id}`)}
                      >
                        <CardContent className="flex h-full flex-col justify-between p-4">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {(() => {
                                    const path = getSubfolderPath(wf.folder_id);
                                    if (path.length === 0) return wf.title;
                                    return (
                                      <>
                                        <span className="text-xs font-normal text-[var(--muted-foreground)]/60">
                                          {path.join(" > ")}
                                          {" > "}
                                        </span>
                                        {wf.title}
                                      </>
                                    );
                                  })()}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                                  {wf.description || "\u00A0"}
                                </p>
                                <div className="mt-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVisibilityTarget({
                                        id: wf.id,
                                        title: wf.title,
                                        override:
                                          wf.visibility_override ?? null,
                                      });
                                    }}
                                    className="rounded opacity-60 hover:opacity-100"
                                    title={t("visibility.settings")}
                                  >
                                    <VisibilityBadge
                                      visibility={
                                        wf.visibility_override ?? "inherit"
                                      }
                                      iconOnly
                                    />
                                  </button>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
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
                                    onClick={() =>
                                      router.push(`/workflows/${wf.id}/edit`)
                                    }
                                  >
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicate(wf)}
                                  >
                                    <Copy className="mr-2 h-3.5 w-3.5" />
                                    {t("common.duplicate")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-[var(--destructive)]"
                                    onClick={() => setDeleteTarget(wf)}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    {t("common.delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-3">
                              <NodePipeline nodes={wf.nodes} />
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                            {wf.nodes.length}
                            {t("workflows.nodes")} &middot;{" "}
                            {new Date(wf.created_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        target={deleteTarget}
        title={t("workflows.deleteConfirm")}
        description={`"${deleteTarget?.title ?? ""}"${t("workflows.deleteDesc")}`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <WorkflowVisibilityDialog
        workflowId={visibilityTarget?.id ?? null}
        workflowTitle={visibilityTarget?.title ?? ""}
        currentOverride={visibilityTarget?.override ?? null}
        open={visibilityTarget !== null}
        onClose={() => setVisibilityTarget(null)}
        onUpdate={fetchWorkflows}
      />

      <WorkflowTransferDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        mode="import"
        folderId={selectedFolder}
        onImported={(workflowId) => router.push(`/workflows/${workflowId}`)}
      />
    </div>
  );
}
