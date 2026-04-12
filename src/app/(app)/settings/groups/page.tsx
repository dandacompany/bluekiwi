"use client";

import { Users } from "lucide-react";
import { GroupsTab } from "@/components/settings/groups-tab";
import { useTranslation } from "@/lib/i18n/context";

export default function GroupsSettingsPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-bold tracking-tight">
          {t("groups.title")}
        </h1>
      </div>
      <GroupsTab />
    </main>
  );
}
