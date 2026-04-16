"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Pencil,
  Settings,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderSettingsDialog } from "@/components/folders/folder-settings-dialog";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

export interface FolderItem {
  id: number;
  name: string;
  is_system: boolean;
  visibility: "personal" | "group" | "public" | "inherit";
  parent_id: number | null;
  is_mine: boolean;
  owner_name: string;
}

interface Folder {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  parent_id: number | null;
  visibility: "personal" | "group" | "public" | "inherit";
  is_system: boolean;
  is_mine: boolean;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  selectedId: number | null;
  onSelect: (folderId: number | null) => void;
  /** Fired after folders load or change — lets parent derive folder names */
  onFoldersChange?: (folders: FolderItem[]) => void;
  /** Fired when a workflow card is dropped onto a folder */
  onWorkflowDrop?: (workflowId: number, folderId: number) => void;
  /** Increment to trigger refetch from parent */
  refreshKey?: number;
  /** Ref-like callback to expose createRootFolder trigger to parent */
  onCreateRootRef?: (fn: () => void) => void;
}

const STORAGE_KEY = "bluekiwi:folder-tree:expanded";

function InlineInput({
  defaultValue = "",
  placeholder,
  onConfirm,
  onCancel,
}: {
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  // Prevent double-commit when blur fires alongside button click
  const committedRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1 pr-1">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") commit();
        }}
        onBlur={commit}
        className="h-6 min-w-0 flex-1 rounded border border-brand-blue-400 bg-[var(--background)] px-1.5 text-sm outline-none ring-1 ring-brand-blue-400/30"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // prevent blur before click
        onClick={commit}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-kiwi-600 hover:bg-kiwi-100"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // prevent blur before click
        onClick={onCancel}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-surface-soft"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

interface CtxMenu {
  x: number;
  y: number;
  folder: Folder;
}

export function FolderTree({
  selectedId,
  onSelect,
  onFoldersChange,
  onWorkflowDrop,
  refreshKey,
  onCreateRootRef,
}: Props) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(
    null,
  );
  const [renaming, setRenaming] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [settingsFolder, setSettingsFolder] = useState<Folder | null>(null);

  const fetchFolders = useCallback(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((j: { data: Folder[] }) => {
        const list = j.data ?? [];
        setFolders(list);
        onFoldersChange?.(
          list.map((f) => ({
            id: f.id,
            name: f.name,
            is_system: f.is_system,
            visibility: f.visibility,
            parent_id: f.parent_id,
            is_mine: f.is_mine,
            owner_name: f.owner_name,
          })),
        );
      })
      .catch(() => setFolders([]));
  }, [onFoldersChange]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders, refreshKey]);

  // Dismiss context menu on any click
  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    document.addEventListener("click", dismiss);
    document.addEventListener("contextmenu", dismiss);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("contextmenu", dismiss);
    };
  }, [ctxMenu]);

  useEffect(() => {
    onCreateRootRef?.(() => setCreating({ parentId: null }));
  }, [onCreateRootRef]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
    } catch {
      /* ignore */
    }
  }, [expanded]);

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = useCallback(
    async (name: string, parentId: number | null) => {
      setCreating(null);
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parent_id: parentId,
          visibility: parentId !== null ? "inherit" : "personal",
        }),
      });
      if (res.ok) {
        if (parentId !== null)
          setExpanded((prev) => new Set([...prev, parentId]));
        fetchFolders();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? t("folders.createFailed"));
      }
    },
    [fetchFolders, t],
  );

  const handleRename = useCallback(
    async (id: number, name: string) => {
      setRenaming(null);
      const res = await fetch(`/api/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        fetchFolders();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? t("folders.renameFailed"));
      }
    },
    [fetchFolders, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedId === id) onSelect(null);
        fetchFolders();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? t("folders.deleteFailed"));
      }
    },
    [fetchFolders, selectedId, onSelect, t],
  );

  // ── 루트 폴더: My Workspace 먼저, 내 폴더 → 공유 폴더 알파벳순
  const rootFolders = folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => {
      // System folders (My Workspace) first
      if (a.is_system && !b.is_system) return -1;
      if (!a.is_system && b.is_system) return 1;
      // Then own folders before shared
      if (a.is_mine && !b.is_mine) return -1;
      if (!a.is_mine && b.is_mine) return 1;
      return a.name.localeCompare(b.name);
    });

  // Shared folder roots that have no parent in the shared set (for non-root shared)
  const sharedFolders = folders.filter((f) => !f.is_mine);
  const sharedRoots = sharedFolders
    .filter(
      (f) =>
        f.parent_id !== null &&
        !sharedFolders.some((s) => s.id === f.parent_id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const childrenOf = (pid: number) =>
    folders.filter((f) => f.parent_id === pid);

  const renderFolder = (folder: Folder, depth = 0) => {
    const kids = childrenOf(folder.id);
    const isOpen = expanded.has(folder.id);
    const isSelected = folder.id === selectedId;
    const isRenaming = renaming === folder.id;
    const isCreatingChild =
      creating !== null && creating.parentId === folder.id;
    const isDropTarget = dropTarget === folder.id;
    const canEdit = folder.is_mine && !folder.is_system;

    return (
      <li key={folder.id}>
        <div
          className={cn(
            "group flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors",
            isSelected
              ? "bg-brand-blue-50 text-brand-blue-700"
              : "hover:bg-surface-soft",
            isDropTarget &&
              "ring-2 ring-brand-blue-400 ring-offset-1 bg-brand-blue-50/60",
          )}
          onClick={() => {
            if (isRenaming) return;
            onSelect(folder.id);
            if (kids.length > 0 && !expanded.has(folder.id)) {
              setExpanded((prev) => new Set([...prev, folder.id]));
            }
          }}
          onDoubleClick={(e) => {
            if (!canEdit) return;
            e.stopPropagation();
            setRenaming(folder.id);
          }}
          onContextMenu={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            e.stopPropagation();
            setCtxMenu({ x: e.clientX, y: e.clientY, folder });
          }}
          /* Drag-and-drop drop target */
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget(folder.id);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTarget(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const wfId = Number(e.dataTransfer.getData("workflowId"));
            if (wfId) onWorkflowDrop?.(wfId, folder.id);
            setDropTarget(null);
          }}
        >
          {/* Expand toggle */}
          {kids.length > 0 || isCreatingChild ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(folder.id);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center"
            >
              {isOpen || isCreatingChild ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Folder icon — shared folders use FolderSymlink with owner tooltip */}
          {!folder.is_mine ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0">
                    {isOpen || isCreatingChild ? (
                      <FolderOpen className="h-3.5 w-3.5 text-kiwi-500" />
                    ) : (
                      <FolderSymlink className="h-3.5 w-3.5 text-kiwi-500" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {folder.owner_name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : isOpen || isCreatingChild ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-brand-blue-500" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
          )}

          {/* Name or inline rename */}
          {isRenaming ? (
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <InlineInput
                defaultValue={folder.name}
                onConfirm={(v) => handleRename(folder.id, v)}
                onCancel={() => setRenaming(null)}
              />
            </div>
          ) : (
            <>
              <span
                className="flex-1 truncate text-sm"
                title={
                  folder.is_system ? t("folders.myWorkspace") : folder.name
                }
              >
                {folder.is_system ? t("folders.myWorkspace") : folder.name}
              </span>
              {folder.is_mine && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingsFolder(folder);
                  }}
                  className="shrink-0 rounded opacity-60 hover:opacity-100"
                  title={t("folders.visibilitySettings")}
                >
                  <VisibilityBadge visibility={folder.visibility} iconOnly />
                </button>
              )}
            </>
          )}
        </div>

        {/* Children + inline create-child input */}
        {(isOpen || isCreatingChild) && (
          <ul
            className="mt-0.5 space-y-1"
            style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
          >
            {kids.map((kid) => renderFolder(kid, depth + 1))}
            {isCreatingChild && (
              <li className="py-0.5">
                <InlineInput
                  placeholder={t("folders.namePlaceholder")}
                  onConfirm={(v) => handleCreate(v, folder.id)}
                  onCancel={() => setCreating(null)}
                />
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <nav className="text-sm">
        <ul className="space-y-1">
          {rootFolders.map((root) => renderFolder(root, 0))}
          {sharedRoots.map((root) => renderFolder(root, 0))}
          {creating?.parentId === null ? (
            <li className="py-0.5 pl-5">
              <InlineInput
                placeholder={t("folders.namePlaceholder")}
                onConfirm={(v) => handleCreate(v, null)}
                onCancel={() => setCreating(null)}
              />
            </li>
          ) : (
            <li>
              <button
                type="button"
                onClick={() => setCreating({ parentId: null })}
                className="flex w-full cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--muted-foreground)]/50 transition-colors hover:text-[var(--muted-foreground)] hover:bg-surface-soft"
              >
                <span className="w-4 shrink-0" />
                <FolderPlus className="h-3.5 w-3.5 shrink-0" />
                <span>{t("folders.new")}</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Context menu — rendered at mouse position */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[140px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--shadow-card)]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-soft"
            onClick={() => {
              setExpanded((p) => new Set([...p, ctxMenu.folder.id]));
              setCreating({ parentId: ctxMenu.folder.id });
              setCtxMenu(null);
            }}
          >
            <FolderPlus className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            {t("folders.addSubfolder")}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-soft"
            onClick={() => {
              setRenaming(ctxMenu.folder.id);
              setCtxMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            {t("folders.rename")}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-soft"
            onClick={() => {
              setSettingsFolder(ctxMenu.folder);
              setCtxMenu(null);
            }}
          >
            <Settings className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            {t("visibility.settings")}
          </button>
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[var(--destructive)] hover:bg-destructive/10"
            onClick={() => {
              handleDelete(ctxMenu.folder.id);
              setCtxMenu(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("common.delete")}
          </button>
        </div>
      )}

      <FolderSettingsDialog
        folder={settingsFolder}
        open={settingsFolder !== null}
        onClose={() => setSettingsFolder(null)}
        onUpdate={() => {
          fetchFolders();
          setSettingsFolder(null);
        }}
      />
    </>
  );
}
