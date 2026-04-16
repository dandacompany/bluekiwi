"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

interface ApiKey {
  id: number;
  prefix: string;
  name: string;
  user_id: number;
  owner_name?: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export function ApiKeysTab() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  /* Create dialog state */
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [cliInitCommand, setCliInitCommand] = useState("");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apikeys");
      const json = await res.json();
      setKeys(json.data ?? []);
    } catch {
      toast.error(t("apiKeys.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleRevoke = async (id: number) => {
    try {
      const res = await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("apiKeys.revokeSuccess"));
      fetchKeys();
    } catch {
      toast.error(t("apiKeys.revokeFailed"));
    }
  };

  const handleCreate = async () => {
    const trimmed = newKeyName.trim();
    if (!trimmed) {
      toast.error(t("apiKeys.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? t("apiKeys.createFailed"));
      }
      const json = await res.json();
      const rawKey = json.data?.raw_key ?? null;
      setCreatedRawKey(rawKey);
      if (rawKey) {
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_APP_URL ?? "");
        setCliInitCommand(
          `npm i -g bluekiwi && bluekiwi init --server ${origin} --api-key ${rawKey}`,
        );
      } else {
        setCliInitCommand("");
      }
      fetchKeys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("apiKeys.createFailed"),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(t("apiKeys.copied"));
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewKeyName("");
      setCreatedRawKey(null);
      setCliInitCommand("");
    }
    setCreateOpen(open);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("ko-KR");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <CardTitle>{t("apiKeys.title")}</CardTitle>
              <CardDescription>{t("apiKeys.description")}</CardDescription>
            </div>
          </div>

          <Dialog open={createOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t("apiKeys.newKey")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              {createdRawKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{t("apiKeys.keyCreated")}</DialogTitle>
                    <DialogDescription>
                      {t("apiKeys.keyWarning")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-md border bg-[var(--muted)] p-3">
                      <code className="flex-1 break-all text-sm">
                        {createdRawKey}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(createdRawKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {cliInitCommand ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {t("apiKeys.cliInitLabel")}
                        </p>
                        <div className="flex items-center gap-2 rounded-md border bg-[var(--muted)] p-3">
                          <code className="flex-1 break-all text-xs leading-5">
                            {cliInitCommand}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(cliInitCommand)}
                            title={t("apiKeys.copyCliCommand")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <p className="text-xs text-[var(--destructive)]">
                      {t("apiKeys.keyWarning2")}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => handleDialogClose(false)}>
                      {t("common.confirm")}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>{t("apiKeys.newKeyTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("apiKeys.newKeyDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <label
                      htmlFor="apikey-name"
                      className="text-sm font-medium"
                    >
                      {t("apiKeys.keyNameLabel")}
                    </label>
                    <Input
                      id="apikey-name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={t("apiKeys.namePlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating
                        ? t("apiKeys.generating")
                        : t("apiKeys.generate")}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            {t("common.loading")}
          </p>
        ) : keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            {t("apiKeys.noKeys")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 pr-4 font-medium">
                    {t("apiKeys.keyName")}
                  </th>
                  {keys.some((k) => k.owner_name) && (
                    <th className="pb-2 pr-4 font-medium">
                      {t("apiKeys.owner")}
                    </th>
                  )}
                  <th className="pb-2 pr-4 font-medium">
                    {t("apiKeys.keyPrefix")}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("apiKeys.expiresAt")}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("apiKeys.status")}
                  </th>
                  <th className="pb-2 font-medium">{t("apiKeys.action")}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">
                      {key.name || t("apiKeys.noName")}
                    </td>
                    {keys.some((k) => k.owner_name) && (
                      <td className="py-3 pr-4">{key.owner_name}</td>
                    )}
                    <td className="py-3 pr-4">
                      <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs">
                        {key.prefix}...
                      </code>
                    </td>
                    <td className="py-3 pr-4">{formatDate(key.expires_at)}</td>
                    <td className="py-3 pr-4">
                      {key.is_revoked ? (
                        <Badge variant="destructive">
                          {t("apiKeys.revoked")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("apiKeys.activeStatus")}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3">
                      {!key.is_revoked && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-[var(--destructive)] hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("apiKeys.revokeConfirm")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                &ldquo;{key.name || key.prefix}&rdquo;{" "}
                                {t("apiKeys.revokeDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("common.cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRevoke(key.id)}
                              >
                                {t("apiKeys.revoke")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
