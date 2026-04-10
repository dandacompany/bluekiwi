"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Users, X } from "lucide-react";
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

export function TeamTab() {
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
      toast.error("Failed to load invites");
    } finally {
      setInviteLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, [fetchInvites, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
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

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create invite");
      }

      const data = (await res.json()) as { url: string; expires_at: string };
      setInviteResult(data);
      toast.success("Invite created");
      fetchInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite");
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
        throw new Error(json?.error ?? "Failed to cancel invite");
      }
      toast.success("Invite cancelled");
      fetchInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel invite");
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("team.inviteTitle")}</DialogTitle>
                <DialogDescription>
                  Share an invite link instead of creating the account directly.
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
                    <label className="text-sm font-medium">
                      {t("team.role")}
                    </label>
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
                  <p className="text-sm">
                    Share this link (expires{" "}
                    {new Date(inviteResult.expires_at).toLocaleDateString()}
                    ):
                  </p>
                  <pre className="break-all rounded-xl bg-[var(--muted)] p-3 text-xs">
                    {inviteResult.url}
                  </pre>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult.url);
                      toast.success("Invite link copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy link
                  </Button>
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
                    {inviting ? "Creating..." : "Create invite"}
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
                Team members
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-accent)] text-sm font-medium text-[var(--sidebar-accent-foreground)]">
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
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Invites
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Pending and accepted team invitations.
              </p>
            </div>
            {inviteLoading ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {t("common.loading")}
              </p>
            ) : invites.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                No invites yet.
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
                          ? `Accepted ${new Date(invite.accepted_at).toLocaleString()}`
                          : `Pending until ${new Date(invite.expires_at).toLocaleString()}`}
                      </p>
                    </div>
                    <Badge variant={ROLE_BADGE_VARIANT[invite.role] ?? "outline"}>
                      {invite.role}
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
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          <X className="h-4 w-4" />
                          Cancel
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
