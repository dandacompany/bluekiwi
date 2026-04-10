"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
} from "lucide-react";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { cn } from "@/lib/utils";

type Visibility = "personal" | "group" | "public";

interface Folder {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  parent_id: number | null;
  visibility: Visibility;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  selectedId: number | null;
  onSelect: (folderId: number | null) => void;
}

const STORAGE_KEY = "bluekiwi:folder-tree:expanded";

export function FolderTree({ selectedId, onSelect }: Props) {
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

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((j: { data: Folder[] }) => setFolders(j.data ?? []))
      .catch(() => setFolders([]));
  }, []);

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

  const roots = folders.filter((f) => f.parent_id === null);
  const childrenOf = (pid: number) =>
    folders.filter((f) => f.parent_id === pid);

  return (
    <nav className="text-sm">
      <ul className="space-y-1">
        {roots.map((root) => {
          const kids = childrenOf(root.id);
          const isOpen = expanded.has(root.id);
          const isSelected = root.id === selectedId;
          return (
            <li key={root.id}>
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-accent",
                  isSelected && "bg-accent",
                )}
                onClick={() => onSelect(root.id)}
              >
                {kids.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(root.id);
                    }}
                    className="flex h-4 w-4 items-center justify-center"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                {isOpen ? (
                  <FolderOpen className="h-4 w-4" />
                ) : (
                  <FolderIcon className="h-4 w-4" />
                )}
                <span className="flex-1 truncate">{root.name}</span>
                <VisibilityBadge visibility={root.visibility} />
              </div>
              {isOpen && kids.length > 0 && (
                <ul className="mt-1 ml-6 space-y-1">
                  {kids.map((kid) => (
                    <li
                      key={kid.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-accent",
                        kid.id === selectedId && "bg-accent",
                      )}
                      onClick={() => onSelect(kid.id)}
                    >
                      <FolderIcon className="h-3 w-3" />
                      <span className="flex-1 truncate">{kid.name}</span>
                      <VisibilityBadge visibility={kid.visibility} inherited />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
