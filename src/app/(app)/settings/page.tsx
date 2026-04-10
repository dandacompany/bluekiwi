"use client";

import { useEffect, useState } from "react";
import { Bell, Settings } from "lucide-react";

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

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {t("settings.userLoadFailed")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
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
          <TabsTrigger value="notifications">
            {t("settings.notifications")}
          </TabsTrigger>
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
        </div>
      </Tabs>
    </main>
  );
}
