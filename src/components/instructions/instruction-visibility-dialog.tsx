"use client";

import { useEffect, useState } from "react";
import { Lock, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";

interface Props {
  instructionId: number | null;
  instructionTitle: string;
  currentOverride: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// Instructions support only `personal` override or `null` (follow folder).
// Group/public sharing is handled at the folder level (folder_shares).
const VISIBILITY_OPTIONS = [
  {
    value: null as null,
    Icon: FolderOpen,
    labelKey: "visibility.followFolder",
    descKey: "visibility.followFolderDesc",
  },
  {
    value: "personal" as const,
    Icon: Lock,
    labelKey: "folders.visibilityPersonal",
    descKey: "folders.visibilityPersonalDesc",
  },
];

export function InstructionVisibilityDialog({
  instructionId,
  instructionTitle,
  currentOverride,
  open,
  onClose,
  onUpdate,
}: Props) {
  const { t } = useTranslation();
  const [pendingOverride, setPendingOverride] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open && instructionId) {
      setPendingOverride(currentOverride); // eslint-disable-line react-hooks/set-state-in-effect -- sync reset on dialog open
    }
  }, [open, instructionId, currentOverride]);

  const handleApply = async () => {
    if (!instructionId || applying) return;

    if (pendingOverride !== currentOverride) {
      setApplying(true);
      const res = await fetch(`/api/instructions/${instructionId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: pendingOverride }),
      });
      setApplying(false);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? t("visibility.changeFailed"));
        return;
      }
    }

    onUpdate();
    onClose();
  };

  const isDirty = pendingOverride !== currentOverride;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="max-w-[200px] truncate">{instructionTitle}</span>
            <span className="text-xs font-normal text-[var(--muted-foreground)]">
              · {t("visibility.settings")}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("visibility.scope")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {VISIBILITY_OPTIONS.map(({ value, Icon, labelKey, descKey }) => {
              const isActive = pendingOverride === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  disabled={applying}
                  onClick={() => setPendingOverride(value)}
                  title={t(descKey)}
                  className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    isActive
                      ? "border-brand-blue-400 bg-brand-blue-50 text-brand-blue-700"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-surface-soft"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={applying}
            onClick={handleApply}
            className={isDirty ? "" : "opacity-60"}
          >
            {applying ? t("visibility.applying") : t("visibility.apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
