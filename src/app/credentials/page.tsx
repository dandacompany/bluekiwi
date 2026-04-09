"use client";

import { useEffect, useState, useCallback } from "react";

import { KeyRound, Plus, Trash2 } from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface MaskedCredential {
  id: number;
  service_name: string;
  title: string;
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

function CredentialForm({
  initial,
  onSave,
  saving,
}: {
  initial?: MaskedCredential;
  onSave: (data: {
    service_name: string;
    title: string;
    description: string;
    secrets: Record<string, string>;
  }) => void;
  saving: boolean;
}) {
  const [serviceName, setServiceName] = useState(initial?.service_name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
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
    if (!serviceName.trim() || !title.trim()) return;
    const secrets: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.key.trim()) {
        secrets[entry.key.trim()] = entry.value;
      }
    }
    onSave({
      service_name: serviceName.trim(),
      title: title.trim(),
      description: description.trim(),
      secrets,
    });
  };

  return (
    <div className="grid gap-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="서비스 이름 (예: openai, github)"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          required
        />
        <Input
          placeholder="크레덴셜 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <Textarea
        placeholder="설명 (선택)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Secrets (Key-Value)</span>
          <Button type="button" variant="ghost" size="sm" onClick={addEntry}>
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
        </div>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                value={entry.key}
                onChange={(e) => updateEntry(i, "key", e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Input
                placeholder={initial ? "(빈칸이면 기존 유지)" : "VALUE"}
                value={entry.value}
                onChange={(e) => updateEntry(i, "value", e.target.value)}
                type="password"
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                onClick={() => removeEntry(i)}
                disabled={entries.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" type="button">
            취소
          </Button>
        </DialogClose>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!serviceName.trim() || !title.trim() || saving}
        >
          {saving ? "저장 중..." : initial ? "수정" : "생성"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<MaskedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<MaskedCredential | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/credentials");
    const json = await res.json();
    setCredentials(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleCreate = async (data: {
    service_name: string;
    title: string;
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
      setCreateOpen(false);
      fetchCredentials();
    }
    setSaving(false);
  };

  const handleEdit = async (data: {
    service_name: string;
    title: string;
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
      setEditOpen(false);
      setEditTarget(null);
      fetchCredentials();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 크레덴셜을 삭제하시겠습니까?")) return;
    await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    fetchCredentials();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[var(--muted)]" />
          <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />새 크레덴셜
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>크레덴셜 생성</DialogTitle>
            </DialogHeader>
            <CredentialForm onSave={handleCreate} saving={saving} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            로딩 중...
          </CardContent>
        </Card>
      ) : credentials.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            등록된 크레덴셜이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => (
            <Card
              key={cred.id}
              className="transition-shadow hover:shadow-[var(--card-shadow-hover)]"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="truncate text-base">
                        {cred.title}
                      </CardTitle>
                      <Badge className="border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]">
                        {cred.service_name}
                      </Badge>
                    </div>
                    {cred.description && (
                      <p className="text-sm text-[var(--muted)]">
                        {cred.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Dialog
                      open={editOpen && editTarget?.id === cred.id}
                      onOpenChange={(open) => {
                        setEditOpen(open);
                        if (!open) setEditTarget(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(cred)}
                        >
                          편집
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>크레덴셜 편집</DialogTitle>
                        </DialogHeader>
                        {editTarget && (
                          <CredentialForm
                            initial={editTarget}
                            onSave={handleEdit}
                            saving={saving}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                      onClick={() => handleDelete(cred.id)}
                      title="삭제"
                      aria-label={`크레덴셜 ${cred.title} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(cred.secrets_masked).map(([key, masked]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-xs"
                    >
                      <span className="text-[var(--muted)]">{key}:</span>
                      <span className="text-[var(--foreground)]">{masked}</span>
                    </span>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="px-5 pb-5 pt-0">
                <p className="text-xs text-[var(--muted)]">
                  {Object.keys(cred.secrets_masked).length}개 시크릿 &middot;{" "}
                  {cred.updated_at}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
