"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { InstructionVisibilityDialog } from "@/components/instructions/instruction-visibility-dialog";
import { FolderTree, type FolderItem } from "@/components/folders/folder-tree";
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

const FOLDER_PANE_WIDTH_KEY = "bluekiwi:instructions:folder-pane-width";
const DEFAULT_FOLDER_PANE_WIDTH = 320;
const MIN_FOLDER_PANE_WIDTH = 240;
const MAX_FOLDER_PANE_WIDTH = 520;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 250;

interface Instruction {
  id: number;
  title: string;
  content: string;
  agent_type: string;
  tags: string;
  priority: number;
  is_active: number;
  credential_id: number | null;
  folder_id?: number;
  owner_id?: number;
  visibility_override?: "personal" | null;
  created_at: string;
  updated_at: string;
}

interface CredentialOption {
  id: number;
  service_name: string;
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

const markdownPreviewClass =
  "prose prose-sm max-w-none text-[var(--muted-foreground)] prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 prose-headings:text-sm prose-headings:font-semibold prose-strong:text-[var(--foreground)] prose-code:rounded prose-code:bg-brand-surface-soft prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-pre:rounded-2xl prose-pre:border prose-pre:border-border prose-pre:bg-brand-surface-soft prose-pre:text-[var(--foreground)]";

export default function InstructionsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get("page"));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const raw = Number(searchParams.get("page_size"));
    return PAGE_SIZE_OPTIONS.includes(raw as (typeof PAGE_SIZE_OPTIONS)[number])
      ? raw
      : 10;
  });
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const raw = searchParams.get("view");
    return raw === "grid" ? "grid" : "list";
  });
  const [selectedFolder, setSelectedFolder] = useState<number | null>(() => {
    const fid = searchParams.get("folder_id");
    return fid ? Number(fid) : null;
  });
  const [folderList, setFolderList] = useState<FolderItem[]>([]);
  const [folderRefreshKey, setFolderRefreshKey] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [renamingHeader, setRenamingHeader] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState("");
  const headerInputRef = useRef<HTMLInputElement>(null);
  const createRootFolderRef = useRef<(() => void) | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isResizingFolders, setIsResizingFolders] = useState(false);
  const [folderPaneWidth, setFolderPaneWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_FOLDER_PANE_WIDTH;
    const raw = window.localStorage.getItem(FOLDER_PANE_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return DEFAULT_FOLDER_PANE_WIDTH;
    return Math.min(
      MAX_FOLDER_PANE_WIDTH,
      Math.max(MIN_FOLDER_PANE_WIDTH, parsed),
    );
  });
  const [rootCtxMenu, setRootCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [visibilityTarget, setVisibilityTarget] = useState<{
    id: number;
    title: string;
    override: string | null;
    folderId?: number;
  } | null>(null);

  // Editor dialog state
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
    credential_id: null as number | null,
  });
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FOLDER_PANE_WIDTH_KEY, String(folderPaneWidth));
  }, [folderPaneWidth]);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data: instructions,
    loading,
    refetch: fetchInstructions,
  } = useListFetch<Instruction>(() => {
    const params = new URLSearchParams();
    if (selectedFolder !== null)
      params.set("folder_id", String(selectedFolder));
    if (debouncedSearch) params.set("q", debouncedSearch);
    return `/api/instructions?${params}`;
  }, [selectedFolder, debouncedSearch]);

  // Fetch credentials for dropdown
  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data ?? []) as CredentialOption[];
        setCredentials(list);
      })
      .catch(() => {});
  }, []);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<Instruction>({
      endpoint: (target) => `/api/instructions/${target.id}`,
      onSuccess: fetchInstructions,
      fallbackMessage: t("common.deleteFailed"),
    });

  const totalPages = Math.max(1, Math.ceil(instructions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = instructions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedFolder, debouncedSearch, pageSize, viewMode]);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedFolder !== null)
      params.set("folder_id", String(selectedFolder));
    if (search.trim()) params.set("q", search.trim());
    if (currentPage > 1) params.set("page", String(currentPage));
    if (pageSize !== 10) params.set("page_size", String(pageSize));
    if (viewMode !== "list") params.set("view", viewMode);

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
  }, [
    pathname,
    router,
    searchParams,
    selectedFolder,
    search,
    currentPage,
    pageSize,
    viewMode,
  ]);

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

  const selectedFolderPath = useMemo<FolderItem[]>(() => {
    if (!selectedFolderItem) return [];
    const path: FolderItem[] = [];
    let current: FolderItem | undefined = selectedFolderItem;
    const visited = new Set<number>();
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      path.unshift(current);
      if (current.parent_id === null) break;
      current = folderList.find((f) => f.id === current!.parent_id);
    }
    return path;
  }, [selectedFolderItem, folderList]);

  const getSubfolderPath = useCallback(
    (instFolderId?: number): string[] => {
      if (!instFolderId || !selectedFolder || instFolderId === selectedFolder)
        return [];
      const names: string[] = [];
      let cur = folderList.find((f) => f.id === instFolderId);
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

  const handleInstructionDrop = useCallback(
    async (instructionId: number, folderId: number) => {
      const res = await fetch(`/api/instructions/${instructionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (res.ok) {
        toast.success(t("instructionsPage.movedToFolder"));
        fetchInstructions();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? t("common.updateFailed"));
      }
    },
    [fetchInstructions, t],
  );

  const startFolderResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop || !layoutRef.current) return;
      event.preventDefault();
      const pointerId = event.pointerId;
      const handle = event.currentTarget;
      setIsResizingFolders(true);
      handle.setPointerCapture(pointerId);

      const updateWidth = (clientX: number) => {
        const bounds = layoutRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const nextWidth = clientX - bounds.left;
        setFolderPaneWidth(
          Math.min(
            MAX_FOLDER_PANE_WIDTH,
            Math.max(MIN_FOLDER_PANE_WIDTH, Math.round(nextWidth)),
          ),
        );
      };

      updateWidth(event.clientX);

      const onPointerMove = (moveEvent: PointerEvent) => {
        updateWidth(moveEvent.clientX);
      };

      const stop = () => {
        setIsResizingFolders(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [isDesktop],
  );

  const layoutStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isDesktop) return undefined;
    return {
      gridTemplateColumns: `${folderPaneWidth}px 8px minmax(0,1fr)`,
    };
  }, [folderPaneWidth, isDesktop]);

  // ── Editor dialog handlers ──
  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      agent_type: "general",
      tags: [],
      priority: 0,
      credential_id: null,
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
      credential_id: form.credential_id,
    };

    if (editing) {
      await fetch(`/api/instructions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      // When creating inside a selected folder, pass folder_id so the new
      // instruction lands there instead of My Workspace.
      await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedFolder !== null
            ? { ...payload, folder_id: selectedFolder }
            : payload,
        ),
      });
    }

    closeEditor();
    fetchInstructions();
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
      credential_id: inst.credential_id,
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
    fetchInstructions();
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

  const renderPaginationControls = useCallback(
    (position: "top" | "bottom") => (
      <div
        className={`flex items-center justify-end gap-2 ${position === "top" ? "mb-4" : "mt-6"}`}
      >
        <span className="text-xs text-[var(--muted-foreground)]">
          {t("instructionsPage.results")}:
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(Number(value));
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-20 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-16 text-right text-xs text-[var(--muted-foreground)]">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    ),
    [currentPage, pageSize, t, totalPages],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h1
              className={`text-2xl font-bold tracking-tight ${
                selectedFolder !== null
                  ? "cursor-pointer hover:text-brand-blue-600 transition-colors"
                  : ""
              }`}
              onClick={() => {
                if (selectedFolder !== null) {
                  setSelectedFolder(null);
                  setRenamingHeader(false);
                  setPage(1);
                }
              }}
            >
              {t("instructionsPage.title")}
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
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("instructionsPage.newInstruction")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        ref={layoutRef}
        className={`grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_8px_minmax(0,1fr)] ${
          isResizingFolders ? "cursor-col-resize" : ""
        }`}
        style={layoutStyle}
      >
        {/* Left: Folder rail */}
        <aside className="flex min-h-0 flex-col border-b border-[var(--border)] bg-surface-soft/60 lg:border-r lg:border-b-0">
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-4">
            <p className="text-sm font-semibold">{t("folders.title")}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {selectedFolderItem
                ? selectedFolderItem.is_system
                  ? t("folders.myWorkspace")
                  : selectedFolderItem.name
                : t("instructionsPage.allInstructions")}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
              {t("instructionsPage.allInstructions")}
            </button>
            <FolderTree
              selectedId={selectedFolder}
              onSelect={handleFolderSelect}
              onFoldersChange={setFolderList}
              onInstructionDrop={handleInstructionDrop}
              refreshKey={folderRefreshKey}
              onCreateRootRef={(fn) => {
                createRootFolderRef.current = fn;
              }}
            />

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

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("folders.title")}
          onPointerDown={startFolderResize}
          className="hidden lg:flex items-stretch justify-center bg-transparent"
        >
          <div className="group flex w-2 cursor-col-resize items-center justify-center">
            <div className="h-full w-px bg-[var(--border)] transition-colors group-hover:bg-brand-blue-400 group-active:bg-brand-blue-500" />
          </div>
        </div>

        {/* Right: Instruction list */}
        <section ref={listScrollRef} className="min-h-0 overflow-y-auto">
          <div className="px-5 py-5">
            <div className="sticky top-0 z-10 -mx-5 mb-4 border-b border-[var(--border)] bg-[var(--background)]/95 px-5 py-3 backdrop-blur-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder={t("common.search")}
                    className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent pl-8 pr-7 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-brand-blue-400 focus:ring-1 focus:ring-brand-blue-400/30"
                  />
                  {search !== debouncedSearch ? (
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[var(--muted-foreground)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </span>
                  ) : (
                    search && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )
                  )}
                </div>
                <div className="shrink-0">
                  {renderPaginationControls("top")}
                </div>
              </div>
            </div>

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
                  {instructions.length}
                  {t("instructionsPage.results")}
                </span>
              </div>
            )}

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
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                      : "flex flex-col gap-2"
                  }
                >
                  {paged.map((inst) => {
                    const tags = JSON.parse(inst.tags || "[]") as string[];
                    const previewMarkdown = buildInstructionPreviewMarkdown(
                      inst.content,
                    );
                    const path = getSubfolderPath(inst.folder_id);
                    const titleNode =
                      path.length === 0 ? (
                        inst.title
                      ) : (
                        <>
                          <span className="text-xs font-normal text-[var(--muted-foreground)]/60">
                            {path.join(" > ")}
                            {" > "}
                          </span>
                          {inst.title}
                        </>
                      );

                    const menu = (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("instructionsPage.actionMenu", {
                              title: inst.title,
                            })}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem onClick={() => handleEdit(inst)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(inst)}>
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
                    );

                    const visibilityButton = (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibilityTarget({
                            id: inst.id,
                            title: inst.title,
                            override: inst.visibility_override ?? null,
                            folderId: inst.folder_id,
                          });
                        }}
                        className="rounded opacity-60 hover:opacity-100"
                        title={t("visibility.settings")}
                      >
                        <VisibilityBadge
                          visibility={inst.visibility_override ?? "inherit"}
                          iconOnly
                        />
                      </button>
                    );

                    return viewMode === "list" ? (
                      <Card
                        key={inst.id}
                        className={`cursor-pointer gap-0 py-0 transition-shadow hover:shadow-soft ${
                          inst.is_active ? "" : "opacity-60"
                        }`}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "instructionId",
                            String(inst.id),
                          )
                        }
                        onClick={() => handleEdit(inst)}
                      >
                        <CardContent className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold">
                                  {titleNode}
                                </p>
                                <Badge>{inst.agent_type}</Badge>
                                {inst.priority > 0 && (
                                  <Badge variant="warning">
                                    P{inst.priority}
                                  </Badge>
                                )}
                                {!inst.is_active && (
                                  <Badge variant="neutral">
                                    {t("instructionsPage.inactive")}
                                  </Badge>
                                )}
                                {visibilityButton}
                              </div>
                            </div>
                            <p className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                              {new Date(inst.created_at).toLocaleDateString(
                                "ko-KR",
                              )}
                            </p>
                            {menu}
                          </div>
                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
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
                        </CardContent>
                      </Card>
                    ) : (
                      <Card
                        key={inst.id}
                        className={`cursor-pointer gap-0 py-0 transition-shadow hover:shadow-soft ${
                          inst.is_active ? "" : "opacity-60"
                        }`}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "instructionId",
                            String(inst.id),
                          )
                        }
                        onClick={() => handleEdit(inst)}
                      >
                        <CardContent className="flex h-full flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold">
                                  {titleNode}
                                </p>
                                <Badge>{inst.agent_type}</Badge>
                                {inst.priority > 0 && (
                                  <Badge variant="warning">
                                    P{inst.priority}
                                  </Badge>
                                )}
                                {!inst.is_active && (
                                  <Badge variant="neutral">
                                    {t("instructionsPage.inactive")}
                                  </Badge>
                                )}
                                {visibilityButton}
                              </div>
                            </div>
                            {menu}
                          </div>
                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
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
                                {previewMarkdown ||
                                  t("instructionsPage.noPreview")}
                              </Markdown>
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                            {new Date(inst.created_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {renderPaginationControls("bottom")}
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Editor dialog ── */}
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
                  {AGENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select
              value={
                form.credential_id !== null
                  ? String(form.credential_id)
                  : "__none__"
              }
              onValueChange={(value) =>
                setForm({
                  ...form,
                  credential_id: value === "__none__" ? null : Number(value),
                })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue
                  placeholder={t("instructionsPage.credentialPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("instructionsPage.noCredential")}
                </SelectItem>
                {credentials.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.service_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BlocknoteEditor
              key={editorKey}
              initialContent={form.content}
              onChange={(md) => setForm((f) => ({ ...f, content: md }))}
            />
            <div className="flex gap-3">
              <div className="flex-1 rounded-[1.25rem] border border-input bg-background px-3 py-2 shadow-none transition-colors focus-within:border-brand-blue-500 focus-within:ring-[4px] focus-within:ring-ring/35">
                <div className="flex flex-wrap items-center gap-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="default" className="gap-1.5 pr-1">
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
                <Button type="button" variant="secondary" onClick={closeEditor}>
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

      <InstructionVisibilityDialog
        instructionId={visibilityTarget?.id ?? null}
        instructionTitle={visibilityTarget?.title ?? ""}
        currentOverride={visibilityTarget?.override ?? null}
        folderName={(() => {
          if (!visibilityTarget?.folderId) return null;
          const f = folderList.find(
            (folder) => folder.id === visibilityTarget.folderId,
          );
          if (!f) return null;
          return f.is_system ? t("folders.myWorkspace") : f.name;
        })()}
        folderVisibility={(() => {
          if (!visibilityTarget?.folderId) return null;
          const f = folderList.find(
            (folder) => folder.id === visibilityTarget.folderId,
          );
          return f?.visibility ?? null;
        })()}
        open={visibilityTarget !== null}
        onClose={() => setVisibilityTarget(null)}
        onUpdate={fetchInstructions}
      />
    </div>
  );
}
