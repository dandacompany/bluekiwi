"use client";

import { useEffect, useState } from "react";
import { Bell, HardDrive, Settings } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { ApiKeysTab } from "@/components/settings/apikeys-tab";
import { TeamTab } from "@/components/settings/team-tab";
import { GroupsTab } from "@/components/settings/groups-tab";
import { useTranslation } from "@/lib/i18n/context";

interface SessionUser {
  userId: number;
  username: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupCounting, setCleanupCounting] = useState(false);
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const [cleanupCount, setCleanupCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setUser(json.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const isSuperuser = user?.role === "superuser";

  async function handleOpenCleanupDialog() {
    setCleanupCounting(true);
    setCleanupCount(null);
    try {
      const res = await fetch("/api/settings/cleanup-visual-html");
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { affected?: number };
      setCleanupCount(json.affected ?? 0);
      setCleanupDialogOpen(true);
    } catch {
      toast.error("Failed to load VS render cache count.");
    } finally {
      setCleanupCounting(false);
    }
  }

  async function handleCleanupVisualHtml() {
    setCleanupSubmitting(true);
    try {
      const res = await fetch("/api/settings/cleanup-visual-html", {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { cleared?: number };
      const cleared = json.cleared ?? 0;
      setCleanupDialogOpen(false);
      setCleanupCount(cleared);
      toast.success(
        `Cleared ${cleared} VS render cache entr${cleared === 1 ? "y" : "ies"}.`,
      );
    } catch {
      toast.error("Failed to clear VS render cache.");
    } finally {
      setCleanupSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {t("settings.userLoadFailed")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("settings.profile")}</TabsTrigger>
          <TabsTrigger value="apikeys">{t("settings.apiKeys")}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team">
              {t("settings.teamManagement")}
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="groups">{t("groups.tabLabel")}</TabsTrigger>
          )}
          <TabsTrigger value="notifications">
            {t("settings.notifications")}
          </TabsTrigger>
          {isSuperuser && <TabsTrigger value="storage">Storage</TabsTrigger>}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="profile">
            <ProfileTab user={user} />
          </TabsContent>

          <TabsContent value="apikeys">
            <ApiKeysTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team">
              <TeamTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="groups">
              <GroupsTab />
            </TabsContent>
          )}

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <CardTitle>{t("settings.notificationsTitle")}</CardTitle>
                </div>
                <CardDescription>
                  {t("settings.notificationsPlaceholder")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("settings.notificationsBody")}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperuser && (
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[var(--muted-foreground)]" />
                    <CardTitle>Storage</CardTitle>
                  </div>
                  <CardDescription>
                    Manage VS render cache for completed and failed tasks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">VS Render Cache</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Clears stored `visual_html` for completed/failed tasks
                        while preserving `web_response`.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCleanupDialog}
                      disabled={cleanupCounting || cleanupSubmitting}
                    >
                      {cleanupCounting
                        ? "Checking..."
                        : "Clear VS render cache"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </div>
      </Tabs>

      <AlertDialog
        open={cleanupDialogOpen}
        onOpenChange={(open) => {
          if (!cleanupSubmitting) setCleanupDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear VS render cache?</AlertDialogTitle>
            <AlertDialogDescription>
              {cleanupCount === null
                ? "Loading affected entry count..."
                : `${cleanupCount} cached VS render entr${cleanupCount === 1 ? "y is" : "ies are"} stored on completed/failed tasks. This clears visual_html only and preserves web_response data.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupSubmitting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCleanupVisualHtml}
              disabled={cleanupSubmitting || cleanupCount === null}
            >
              {cleanupSubmitting ? "Clearing..." : "Clear cache"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
