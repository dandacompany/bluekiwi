"use client";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "./i18n/context";
import { translateServerError } from "./i18n/server-errors";

export interface UseDeleteHandlerOptions<T> {
  endpoint: (target: T) => string;
  onSuccess: () => void | Promise<void>;
  fallbackMessage: string;
}

export interface UseDeleteHandlerResult<T> {
  deleteTarget: T | null;
  setDeleteTarget: (target: T | null) => void;
  handleDelete: () => Promise<void>;
}

/**
 * Couples the "delete target" state with the shared delete flow:
 * 1. Open confirm dialog via setDeleteTarget(row)
 * 2. DeleteConfirmDialog calls handleDelete() from its confirm button
 * 3. On success: clear deleteTarget, run onSuccess (typically refetch)
 * 4. On failure: clear deleteTarget, surface translated server error via toast
 */
export function useDeleteHandler<T>(
  opts: UseDeleteHandlerOptions<T>,
): UseDeleteHandlerResult<T> {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const res = await fetch(opts.endpoint(deleteTarget), { method: "DELETE" });
    if (!res.ok) {
      let body: { error?: Parameters<typeof translateServerError>[0] } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore non-JSON body */
      }
      toast.error(translateServerError(body.error, t, opts.fallbackMessage));
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    await opts.onSuccess();
  }, [deleteTarget, opts, t]);

  return { deleteTarget, setDeleteTarget, handleDelete };
}
