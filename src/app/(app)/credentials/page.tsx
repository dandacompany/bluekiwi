"use client";

import { useEffect, useRef, useState } from "react";

import {
  Eye,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommandDialog } from "@/components/ui/command";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useListFetch } from "@/lib/use-list-fetch";
import { useDeleteHandler } from "@/lib/use-delete-handler";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/context";

interface MaskedCredential {
  id: number;
  service_name: string;
  description: string;
  secrets_masked: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface SecretEntry {
  key: string;
  value: string;
}

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

function formatCredentialDate(value: string) {
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

function CredentialForm({
  initial,
  serviceName,
  onSave,
  onCancel,
  saving,
}: {
  initial?: MaskedCredential;
  serviceName: string;
  onSave: (data: {
    service_name: string;
    description: string;
    secrets: Record<string, string>;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [entries, setEntries] = useState<(SecretEntry & { id: string })[]>(
    () => {
      if (initial?.secrets_masked) {
        return Object.entries(initial.secrets_masked).map(([key]) => ({
          id: newKey(),
          key,
          value: "",
        }));
      }
      return [{ id: newKey(), key: "", value: "" }];
    },
  );

  const addEntry = () => {
    setEntries([...entries, { id: newKey(), key: "", value: "" }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: "key" | "value", val: string) => {
    setEntries(
      entries.map((e, i) => (i === index ? { ...e, [field]: val } : e)),
    );
  };

  const handleSubmit = () => {
    if (!serviceName.trim()) return;
    const secrets: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.key.trim()) {
        secrets[entry.key.trim()] = entry.value;
      }
    }
    onSave({
      service_name: serviceName.trim(),
      description: description.trim(),
      secrets,
    });
  };

  return (
    <div className="grid gap-4">
      <Textarea
        placeholder={t("credentials.descriptionPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            {t("credentials.secretsLabel")}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={addEntry}>
            <Plus className="h-3.5 w-3.5" />
            {t("common.add")}
          </Button>
        </div>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2">
              <Input
                placeholder={t("credentials.secretKeyPlaceholder")}
                value={entry.key}
                onChange={(e) => updateEntry(i, "key", e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Input
                placeholder={
                  initial
                    ? t("credentials.secretValueKeepPlaceholder")
                    : t("credentials.secretValuePlaceholder")
                }
                value={entry.value}
                onChange={(e) => updateEntry(i, "value", e.target.value)}
                type="password"
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--destructive)] hover:bg-destructive/10"
                onClick={() => removeEntry(i)}
                disabled={entries.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("credentials.footerHint")}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!serviceName.trim() || saving}
          >
            {saving
              ? t("settings.saving")
              : initial
                ? t("common.save")
                : t("common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CredentialsPage() {
  const { t } = useTranslation();
  const {
    data: credentials,
    loading,
    refetch: fetchCredentials,
  } = useListFetch<MaskedCredential>("/api/credentials", []);
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<number, Record<string, string>>
  >({});

  const toggleReveal = async (credId: number) => {
    if (revealedSecrets[credId]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[credId];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/credentials/${credId}/reveal`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error(t("rbacErrors.credentialRevealDenied"));
      return;
    }
    const json = await res.json();
    try {
      const parsed =
        typeof json.data.secrets === "string"
          ? JSON.parse(json.data.secrets)
          : json.data.secrets;
      setRevealedSecrets((prev) => ({ ...prev, [credId]: parsed }));
    } catch {
      toast.error(t("rbacErrors.credentialRevealDenied"));
    }
  };
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<MaskedCredential | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftServiceName, setDraftServiceName] = useState("");
  const [serviceNameEditing, setServiceNameEditing] = useState(false);
  const serviceNameInputRef = useRef<HTMLInputElement>(null);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<MaskedCredential>({
      endpoint: (target) => `/api/credentials/${target.id}`,
      onSuccess: fetchCredentials,
      fallbackMessage: t("common.deleteFailed"),
    });

  useEffect(() => {
    if (!editorOpen || !serviceNameEditing) return;
    serviceNameInputRef.current?.focus();
    serviceNameInputRef.current?.select();
  }, [editorOpen, serviceNameEditing]);

  const closeEditor = () => {
    setEditorOpen(false);
    setEditTarget(null);
    setDraftServiceName("");
    setServiceNameEditing(false);
  };

  const openCreateDialog = () => {
    setEditTarget(null);
    setDraftServiceName(t("credentials.defaultServiceName"));
    setServiceNameEditing(false);
    setEditorOpen(true);
  };

  const openEditDialog = (credential: MaskedCredential) => {
    setEditTarget(credential);
    setDraftServiceName(credential.service_name);
    setServiceNameEditing(false);
    setEditorOpen(true);
  };

  const handleCreate = async (data: {
    service_name: string;
    description: string;
    secrets: Record<string, string>;
  }) => {
    setSaving(true);
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      closeEditor();
      fetchCredentials();
    }
    setSaving(false);
  };

  const handleEdit = async (data: {
    service_name: string;
    description: string;
    secrets: Record<string, string>;
  }) => {
    if (!editTarget) return;
    setSaving(true);
    const res = await fetch(`/api/credentials/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      closeEditor();
      fetchCredentials();
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("credentials.title")}
            </h1>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            {t("credentials.newCredential")}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-7xl w-full px-6 py-6">
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
            editTarget
              ? t("credentials.editCredential")
              : t("credentials.createCredential")
          }
          description={t("credentials.serviceNameEditHint")}
          className="w-[min(72rem,calc(100vw-2rem))] max-w-none rounded-[1.75rem] border border-border/70 bg-background/95 p-0 shadow-[0_24px_80px_rgba(20,39,86,0.22)] sm:max-w-[72rem]"
        >
          <div className="border-b border-border/70 px-5 py-4">
            <div className="min-w-0">
              {serviceNameEditing ? (
                <Input
                  ref={serviceNameInputRef}
                  value={draftServiceName}
                  onChange={(e) => setDraftServiceName(e.target.value)}
                  onBlur={() => setServiceNameEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setServiceNameEditing(false);
                    }
                  }}
                  aria-label={t("credentials.serviceNamePlaceholder")}
                  className="h-11 max-w-xl text-xl font-semibold"
                />
              ) : (
                <button
                  type="button"
                  className="max-w-full cursor-text text-left"
                  onDoubleClick={() => setServiceNameEditing(true)}
                >
                  <p className="truncate text-xl font-semibold text-foreground">
                    {draftServiceName || t("credentials.defaultServiceName")}
                  </p>
                </button>
              )}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {t("credentials.serviceNameEditHint")}
              </p>
            </div>
          </div>
          <div className="p-5">
            <CredentialForm
              key={editTarget?.id ?? "new"}
              initial={editTarget ?? undefined}
              serviceName={draftServiceName}
              onSave={editTarget ? handleEdit : handleCreate}
              onCancel={closeEditor}
              saving={saving}
            />
          </div>
        </CommandDialog>

        <DeleteConfirmDialog
          target={deleteTarget}
          title={t("common.delete")}
          description={t("credentials.deleteConfirm")}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("common.loading")}
            </CardContent>
          </Card>
        ) : credentials.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("credentials.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {credentials.map((cred) => (
              <Card
                key={cred.id}
                className="cursor-pointer transition-shadow hover:shadow-soft"
                onClick={() => openEditDialog(cred)}
              >
                <CardContent className="p-4">
                  <div className="-mx-4 -mt-4 mb-3 rounded-t-[1.35rem] border-b border-border bg-kiwi-100/50 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {cred.service_name}
                        </p>
                        <p className="line-clamp-1 text-xs text-[var(--muted-foreground)]">
                          {cred.description ||
                            t("credentials.emptyDescription")}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              aria-label={t("credentials.actionMenu").replace(
                                "{service}",
                                cred.service_name,
                              )}
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
                              onClick={() => openEditDialog(cred)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(cred)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {Object.entries(cred.secrets_masked ?? {}).map(
                      ([key, masked]) => {
                        const revealed = revealedSecrets[cred.id]?.[key];
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-xs"
                          >
                            <span className="text-[var(--muted-foreground)]">
                              {key}:
                            </span>
                            <span className="text-[var(--foreground)]">
                              {revealed ?? masked}
                            </span>
                          </span>
                        );
                      },
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReveal(cred.id);
                      }}
                      title={
                        revealedSecrets[cred.id]
                          ? t("credentials.mask")
                          : t("credentials.reveal")
                      }
                    >
                      {revealedSecrets[cred.id] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>

                  <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                    {t("credentials.secretCount", {
                      count: Object.keys(cred.secrets_masked ?? {}).length,
                    })}{" "}
                    &middot; {formatCredentialDate(cred.updated_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
