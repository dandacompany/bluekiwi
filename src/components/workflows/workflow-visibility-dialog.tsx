"use client";

import { useEffect, useState, useCallback } from "react";
import { Lock, Users, Globe, Trash2, Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FolderShareLevel } from "@/lib/db";

interface Group {
  id: number;
  name: string;
}

interface ShareRow {
  group_id: number;
  group_name: string;
  access_level: FolderShareLevel;
}

interface Props {
  workflowId: number | null;
  workflowTitle: string;
  currentOverride: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const VISIBILITY_OPTIONS = [
  {
    value: null as null,
    Icon: FolderOpen,
    label: "폴더 따름",
    description: "폴더 공개 범위 상속",
  },
  {
    value: "personal" as const,
    Icon: Lock,
    label: "개인",
    description: "나만 볼 수 있음",
  },
  {
    value: "group" as const,
    Icon: Users,
    label: "그룹",
    description: "지정 그룹 공유",
  },
  {
    value: "public" as const,
    Icon: Globe,
    label: "공개",
    description: "모든 사용자 접근",
  },
];

export function WorkflowVisibilityDialog({
  workflowId,
  workflowTitle,
  currentOverride,
  open,
  onClose,
  onUpdate,
}: Props) {
  // pendingOverride: 로컬 선택 상태 — 적용 버튼 누르기 전까지 API 호출 안 함
  const [pendingOverride, setPendingOverride] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [addGroupId, setAddGroupId] = useState<number | "">("");
  const [addLevel, setAddLevel] = useState<FolderShareLevel>("reader");
  const [applying, setApplying] = useState(false);

  const loadShares = useCallback(async () => {
    if (!workflowId) return;
    const res = await fetch(`/api/workflows/${workflowId}/shares`);
    if (res.ok) {
      const j = await res.json();
      setShares(j.data ?? []);
    }
  }, [workflowId]);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/settings/groups");
    if (res.ok) {
      const j = await res.json();
      setGroups(j.data ?? []);
    }
  }, []);

  useEffect(() => {
    if (open && workflowId) {
      setPendingOverride(currentOverride);
      setAddGroupId("");
      loadShares();
      loadGroups();
    }
  }, [open, workflowId, currentOverride, loadShares, loadGroups]);

  // 적용 버튼: visibility가 바뀐 경우에만 API 호출, 그 후 닫기
  const handleApply = async () => {
    if (!workflowId || applying) return;

    if (pendingOverride !== currentOverride) {
      setApplying(true);
      const res = await fetch(`/api/workflows/${workflowId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: pendingOverride }),
      });
      setApplying(false);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "공개 범위 변경 실패");
        return;
      }
    }

    onUpdate();
    onClose();
  };

  // 그룹 추가/삭제는 즉시 반영 (shares 테이블은 visibility와 독립)
  const handleAddShare = async () => {
    if (!workflowId || !addGroupId) return;
    const res = await fetch(`/api/workflows/${workflowId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: addGroupId, access_level: addLevel }),
    });
    if (res.ok) {
      setAddGroupId("");
      await loadShares();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? "그룹 추가 실패");
    }
  };

  const handleRemoveShare = async (groupId: number) => {
    if (!workflowId) return;
    const res = await fetch(`/api/workflows/${workflowId}/shares/${groupId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadShares();
    } else {
      toast.error("그룹 제거 실패");
    }
  };

  const availableGroups = groups.filter(
    (g) => !shares.some((s) => s.group_id === g.id),
  );

  const isDirty = pendingOverride !== currentOverride;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="max-w-[200px] truncate">{workflowTitle}</span>
            <span className="text-xs font-normal text-[var(--muted-foreground)]">
              · 공개 설정
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Visibility selector ── */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            공개 범위
          </p>
          <div className="grid grid-cols-4 gap-2">
            {VISIBILITY_OPTIONS.map(({ value, Icon, label, description }) => {
              const isActive = pendingOverride === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  disabled={applying}
                  onClick={() => setPendingOverride(value)}
                  title={description}
                  className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    isActive
                      ? "border-brand-blue-400 bg-brand-blue-50 text-brand-blue-700"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-surface-soft"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Group shares (only when pendingOverride = 'group') ── */}
        {pendingOverride === "group" && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              그룹 공유
            </p>

            {shares.length === 0 ? (
              <p className="px-1 text-xs text-[var(--muted-foreground)]">
                공유된 그룹이 없습니다.
              </p>
            ) : (
              <ul className="mb-2 space-y-1">
                {shares.map((s) => (
                  <li
                    key={s.group_id}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-surface-soft px-2.5 py-1.5"
                  >
                    <Users className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                    <span className="flex-1 truncate text-sm">
                      {s.group_name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        s.access_level === "contributor"
                          ? "bg-brand-blue-100 text-brand-blue-700"
                          : "bg-[var(--border)]/40 text-[var(--muted-foreground)]"
                      }`}
                    >
                      {s.access_level === "contributor" ? "편집자" : "열람자"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveShare(s.group_id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-destructive/10 hover:text-[var(--destructive)]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {groups.length === 0 ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                생성된 그룹이 없습니다. 설정 &gt; 그룹에서 먼저 만들어 주세요.
              </p>
            ) : availableGroups.length === 0 ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                모든 그룹이 이미 공유되어 있습니다.
              </p>
            ) : (
              <div className="flex gap-1.5">
                <select
                  value={addGroupId}
                  onChange={(e) => setAddGroupId(Number(e.target.value) || "")}
                  className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 text-xs outline-none focus:border-brand-blue-400"
                >
                  <option value="">그룹 선택</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={addLevel}
                  onChange={(e) =>
                    setAddLevel(e.target.value as FolderShareLevel)
                  }
                  className="h-7 w-20 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 text-xs outline-none focus:border-brand-blue-400"
                >
                  <option value="reader">열람자</option>
                  <option value="contributor">편집자</option>
                </select>
                <button
                  type="button"
                  disabled={!addGroupId}
                  onClick={handleAddShare}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-blue-600 text-white hover:bg-brand-blue-700 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            disabled={applying}
            onClick={handleApply}
            className={isDirty ? "" : "opacity-60"}
          >
            {applying ? "적용 중…" : "적용"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
