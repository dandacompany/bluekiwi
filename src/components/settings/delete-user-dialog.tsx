"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

interface TargetUser {
  id: number;
  username: string;
  role: string;
}

interface DeleteUserDialogProps {
  target: TargetUser;
  isSelf: boolean;
  trigger: React.ReactNode;
  onSuccess: () => void;
}

interface UserOption {
  id: number;
  username: string;
}

export function DeleteUserDialog({
  target,
  isSelf,
  trigger,
  onSuccess,
}: DeleteUserDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"transfer" | "delete_all">("transfer");
  const [transferTo, setTransferTo] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      const list = (json.data ?? []) as UserOption[];
      setUsers(list.filter((u) => u.id !== target.id));
    } catch {
      // ignore
    }
  }, [target.id]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setMode("transfer");
      setTransferTo("");
      setPassword("");
    }
  }, [open, fetchUsers]);

  const handleSubmit = async () => {
    if (mode === "transfer" && !transferTo) return;
    if (isSelf && !password) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { mode };
      if (mode === "transfer") body.transfer_to = transferTo;
      if (isSelf) body.password = password;

      const res = await fetch(`/api/users/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        const msg =
          json.error?.message ??
          t(isSelf ? "deleteAccount.failed" : "team.deleteUserFailed");
        toast.error(msg);
        return;
      }

      toast.success(
        t(isSelf ? "deleteAccount.success" : "team.deleteUserSuccess"),
      );
      setOpen(false);
      onSuccess();
    } catch {
      toast.error(t(isSelf ? "deleteAccount.failed" : "team.deleteUserFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    (mode === "delete_all" || (mode === "transfer" && transferTo)) &&
    (!isSelf || password);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(isSelf ? "deleteAccount.dialogTitle" : "team.deleteUserTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf ? t("deleteAccount.dialogDesc") : t("team.deleteUserDesc")}
            {!isSelf && (
              <span className="mt-1 block font-medium text-[var(--foreground)]">
                {target.username}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t(isSelf ? "deleteAccount.mode" : "team.deleteUserMode")}
            </label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === "transfer"}
                  onChange={() => setMode("transfer")}
                  className="accent-[var(--primary)]"
                />
                {t(
                  isSelf ? "deleteAccount.transfer" : "team.deleteUserTransfer",
                )}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === "delete_all"}
                  onChange={() => setMode("delete_all")}
                  className="accent-[var(--primary)]"
                />
                {t(
                  isSelf
                    ? "deleteAccount.deleteAll"
                    : "team.deleteUserDeleteAll",
                )}
              </label>
            </div>
          </div>

          {/* Transfer target */}
          {mode === "transfer" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t(
                  isSelf
                    ? "deleteAccount.transferTo"
                    : "team.deleteUserTransferTo",
                )}
              </label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={transferTo}
                onChange={(e) =>
                  setTransferTo(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">
                  {t(
                    isSelf
                      ? "deleteAccount.selectTarget"
                      : "team.deleteUserSelectTarget",
                  )}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t(
                  isSelf
                    ? "deleteAccount.transferWarning"
                    : "team.deleteUserTransferWarning",
                )}
              </p>
            </div>
          )}

          {/* Delete all warning */}
          {mode === "delete_all" && (
            <p className="rounded-md border border-[var(--destructive)] bg-destructive/10 p-3 text-xs text-[var(--destructive)]">
              {t(
                isSelf
                  ? "deleteAccount.deleteAllWarning"
                  : "team.deleteUserDeleteAllWarning",
              )}
            </p>
          )}

          {/* Password (self-delete only) */}
          {isSelf && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("deleteAccount.password")}
              </label>
              <Input
                type="password"
                placeholder={t("deleteAccount.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValid) handleSubmit();
                }}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting
              ? t("common.loading")
              : t(isSelf ? "deleteAccount.confirm" : "team.deleteUser")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
