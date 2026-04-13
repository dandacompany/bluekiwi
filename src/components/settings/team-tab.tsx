"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  HelpCircle,
  Minus,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DeleteUserDialog } from "./delete-user-dialog";

interface Member {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Invite {
  id: number;
  token: string;
  email: string;
  role: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  created_by_name: string | null;
}

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> =
  {
    superuser: "default",
    admin: "default",
    editor: "secondary",
    viewer: "outline",
  };

const ROLE_LEVEL: Record<string, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  superuser: 3,
};

export function TeamTab({ callerRole }: { callerRole: string }) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(true);

  /* Invite dialog state */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    url: string;
    expires_at: string;
    email_sent: boolean;
  } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      setMembers(json.data ?? []);
    } catch {
      toast.error(t("team.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchInvites = useCallback(async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invites");
      const json = await res.json();
      setInvites(json.invites ?? []);
    } catch {
      toast.error(t("team.invitesLoadFailed"));
    } finally {
      setInviteLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, [fetchInvites, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error(t("team.emailRequired"));
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? t("team.inviteCreateFailed"));
      }

      const data = json.data as {
        url: string;
        expires_at: string;
        email_sent: boolean;
      };
      setInviteResult(data);
      toast.success(t("team.inviteCreated"));
      fetchInvites();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("team.inviteCreateFailed"),
      );
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: number) => {
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? t("team.inviteCancelFailed"));
      }
      toast.success(t("team.inviteCancelled"));
      fetchInvites();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("team.inviteCancelFailed"),
      );
    }
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("editor");
    setInviteResult(null);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) resetInviteForm();
    setInviteOpen(open);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <CardTitle>{t("team.title")}</CardTitle>
              <CardDescription>{t("team.description")}</CardDescription>
            </div>
          </div>

          <Dialog open={inviteOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t("team.inviteMember")}
              </Button>
            </DialogTrigger>
            <DialogContent className="overflow-hidden">
              <DialogHeader>
                <DialogTitle>{t("team.inviteTitle")}</DialogTitle>
                <DialogDescription>
                  {t("team.inviteDescription")}
                </DialogDescription>
              </DialogHeader>
              {!inviteResult ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="invite-email"
                      className="text-sm font-medium"
                    >
                      {t("team.email")}
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t("team.emailPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-sm font-medium">
                        {t("team.role")}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[340px] p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                            역할별 권한
                          </p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)]">
                                <th className="pb-1.5 text-left font-medium text-[var(--muted-foreground)]">
                                  기능
                                </th>
                                <th className="pb-1.5 text-center font-medium">
                                  열람자
                                </th>
                                <th className="pb-1.5 text-center font-medium">
                                  편집자
                                </th>
                                <th className="pb-1.5 text-center font-medium">
                                  관리자
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {[
                                {
                                  label: t("team.permViewWorkflows"),
                                  v: true,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permExecuteWorkflows"),
                                  v: true,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permCreateEditWorkflows"),
                                  v: false,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permDeleteOwnWorkflows"),
                                  v: false,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permViewCredentials"),
                                  v: true,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permCreateEditCredentials"),
                                  v: false,
                                  e: true,
                                  a: true,
                                },
                                {
                                  label: t("team.permViewMembers"),
                                  v: false,
                                  e: false,
                                  a: true,
                                },
                                {
                                  label: t("team.permManageMembers"),
                                  v: false,
                                  e: false,
                                  a: true,
                                },
                                {
                                  label: t("team.permManageFolderShares"),
                                  v: false,
                                  e: false,
                                  a: true,
                                },
                              ].map(({ label, v, e, a }) => (
                                <tr key={label}>
                                  <td className="py-1.5 text-[var(--foreground)]">
                                    {label}
                                  </td>
                                  {[v, e, a].map((ok, i) => (
                                    <td key={i} className="py-1.5 text-center">
                                      {ok ? (
                                        <Check className="mx-auto h-3 w-3 text-kiwi-600" />
                                      ) : (
                                        <Minus className="mx-auto h-3 w-3 text-[var(--muted-foreground)]/40" />
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                            * superuser는 모든 권한을 가집니다.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          {t("team.roleAdmin")}
                        </SelectItem>
                        <SelectItem value="editor">
                          {t("team.roleEditor")}
                        </SelectItem>
                        <SelectItem value="viewer">
                          {t("team.roleViewer")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {inviteResult.email_sent ? (
                    <p className="flex items-center gap-1.5 text-sm text-kiwi-600">
                      <Check className="h-4 w-4 shrink-0" />
                      {inviteEmail}로 초대 이메일을 발송했습니다.
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t("team.shareLinkExpires", {
                        date: new Date(
                          inviteResult.expires_at,
                        ).toLocaleDateString(),
                      })}
                    </p>
                  )}
                  <div className="flex w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted)]">
                    <input
                      readOnly
                      value={inviteResult.url}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-[var(--foreground)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteResult.url);
                        toast.success(t("team.inviteLinkCopied"));
                      }}
                      className="flex shrink-0 items-center gap-1.5 border-l border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--border)]/30 hover:text-[var(--foreground)]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("team.copyLink")}
                    </button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                >
                  {t("common.cancel")}
                </Button>
                {!inviteResult ? (
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? t("team.creating") : t("team.createInvite")}
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t("team.members")}
              </h3>
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {t("common.loading")}
              </p>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {t("team.noMembers")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-100 text-sm font-medium text-brand-blue-700">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.username}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {member.email ?? "-"}
                      </p>
                    </div>
                    <Badge
                      variant={ROLE_BADGE_VARIANT[member.role] ?? "outline"}
                    >
                      {member.role === "admin"
                        ? t("team.roleAdmin")
                        : member.role === "editor"
                          ? t("team.roleEditor")
                          : member.role === "viewer"
                            ? t("team.roleViewer")
                            : member.role}
                    </Badge>
                    {(ROLE_LEVEL[callerRole] ?? 0) >
                      (ROLE_LEVEL[member.role] ?? 0) && (
                      <DeleteUserDialog
                        target={{
                          id: member.id,
                          username: member.username,
                          role: member.role,
                        }}
                        isSelf={false}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-[var(--destructive)] hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        onSuccess={fetchMembers}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t("team.invites")}
              </h3>
            </div>
            {inviteLoading ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {t("common.loading")}
              </p>
            ) : invites.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {t("team.noInvites")}
              </p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {invite.email}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {invite.accepted_at
                          ? t("team.inviteAccepted", {
                              date: new Date(
                                invite.accepted_at,
                              ).toLocaleString(),
                            })
                          : t("team.invitePending", {
                              date: new Date(
                                invite.expires_at,
                              ).toLocaleString(),
                            })}
                      </p>
                    </div>
                    <Badge
                      variant={ROLE_BADGE_VARIANT[invite.role] ?? "outline"}
                    >
                      {invite.role === "admin"
                        ? t("team.roleAdmin")
                        : invite.role === "editor"
                          ? t("team.roleEditor")
                          : invite.role === "viewer"
                            ? t("team.roleViewer")
                            : invite.role}
                    </Badge>
                    {!invite.accepted_at ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/invite/${invite.token}`,
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          {t("team.copyInviteLink")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          <X className="h-4 w-4" />
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
