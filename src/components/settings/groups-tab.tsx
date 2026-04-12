"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/context";

interface Group {
  id: number;
  name: string;
  description: string;
}

interface Member {
  id: number;
  username: string;
}

interface UserOption {
  id: number;
  username: string;
  email: string | null;
}

export function GroupsTab() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [newName, setNewName] = useState("");
  const [addUserId, setAddUserId] = useState<number | "">("");
  const [creating, setCreating] = useState(false);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/settings/groups");
    if (res.ok) {
      const j = await res.json();
      setGroups(j.data ?? []);
    }
  }, []);

  const loadMembers = useCallback(async (groupId: number) => {
    const res = await fetch(`/api/settings/groups/${groupId}/members`);
    if (res.ok) {
      const j = await res.json();
      setMembers(j.data ?? []);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const j = await res.json();
      setAllUsers(j.data ?? []);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadUsers();
  }, [loadGroups, loadUsers]);

  useEffect(() => {
    if (selected) loadMembers(selected.id);
    else setMembers([]);
  }, [selected, loadMembers]);

  const handleCreateGroup = async () => {
    if (!newName.trim()) {
      toast.error(t("groups.nameRequired"));
      return;
    }
    setCreating(true);
    const res = await fetch("/api/settings/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (res.ok) {
      setNewName("");
      toast.success(t("groups.created"));
      await loadGroups();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? t("groups.createFailed"));
    }
  };

  const handleAddMember = async () => {
    if (!selected || !addUserId) return;
    const res = await fetch(`/api/settings/groups/${selected.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: addUserId }),
    });
    if (res.ok) {
      setAddUserId("");
      toast.success(t("groups.memberAdded"));
      await loadMembers(selected.id);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? t("groups.memberAddFailed"));
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selected) return;
    const res = await fetch(`/api/settings/groups/${selected.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      toast.success(t("groups.memberRemoved"));
      await loadMembers(selected.id);
    } else {
      toast.error(t("groups.memberRemoveFailed"));
    }
  };

  const handleDeleteGroup = async () => {
    if (!selected) return;
    if (!confirm(t("groups.deleteConfirm"))) return;
    const res = await fetch(`/api/settings/groups/${selected.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("groups.deleted"));
      setSelected(null);
      await loadGroups();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? t("groups.deleteFailed"));
    }
  };

  const nonMembers = allUsers.filter(
    (u) => !members.some((m) => m.id === u.id),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--muted-foreground)]" />
          <CardTitle>{t("groups.title")}</CardTitle>
        </div>
        <CardDescription>{t("groups.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[220px_1fr] gap-6">
          {/* ── Left: group list + create ── */}
          <aside>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("groups.title")}
            </p>
            {groups.length === 0 ? (
              <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                {t("groups.noGroups")}
              </p>
            ) : (
              <ul className="mb-3 space-y-0.5">
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(g)}
                      className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors ${
                        selected?.id === g.id
                          ? "bg-brand-blue-100 font-medium text-brand-blue-700"
                          : "text-[var(--foreground)] hover:bg-surface-soft"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="truncate">{g.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Create group */}
            <div className="flex gap-1.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                placeholder={t("groups.groupNamePlaceholder")}
                className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 text-xs outline-none placeholder:text-[var(--muted-foreground)] focus:border-brand-blue-400"
              />
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={handleCreateGroup}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-blue-600 text-white hover:bg-brand-blue-700 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>

          {/* ── Right: selected group detail ── */}
          <div>
            {!selected ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("groups.selectGroup")}
              </p>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">{selected.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteGroup}
                    className="h-7 gap-1.5 text-[var(--destructive)] hover:bg-destructive/10 hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("groups.deleteGroup")}
                  </Button>
                </div>

                {/* Members list */}
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {t("groups.members")}
                </p>
                {members.length === 0 ? (
                  <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                    {t("groups.noMembers")}
                  </p>
                ) : (
                  <ul className="mb-3 space-y-0.5">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 hover:bg-surface-soft"
                      >
                        <span className="flex-1 text-sm">@{m.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-destructive/10 hover:text-[var(--destructive)]"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add member */}
                {nonMembers.length > 0 && (
                  <div className="flex gap-1.5">
                    <select
                      value={addUserId}
                      onChange={(e) =>
                        setAddUserId(Number(e.target.value) || "")
                      }
                      className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 text-xs outline-none focus:border-brand-blue-400"
                    >
                      <option value="">{t("groups.selectUser")}</option>
                      {nonMembers.map((u) => (
                        <option key={u.id} value={u.id}>
                          @{u.username}
                          {u.email ? ` (${u.email})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!addUserId}
                      onClick={handleAddMember}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-blue-600 text-white hover:bg-brand-blue-700 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
