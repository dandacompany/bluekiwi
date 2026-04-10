"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/context";

interface Activity {
  id: number;
  task_id: number;
  workflow_title: string;
  status: string;
  step_title: string;
  created_at: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-brand-blue-600",
  failed: "bg-[var(--destructive)]",
  in_progress: "bg-brand-blue-600",
  pending: "bg-kiwi-600",
  running: "bg-brand-blue-600",
  skipped: "bg-[var(--muted-foreground)]",
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());

  function timeAgo(dateStr: string): string {
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return t("dashboard.timeJustNow");
    if (diffMin < 60) return t("dashboard.timeMinutesAgo", { n: diffMin });

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t("dashboard.timeHoursAgo", { n: diffHr });

    const diffDay = Math.floor(diffHr / 24);
    return t("dashboard.timeDaysAgo", { n: diffDay });
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-sm">
          {t("dashboard.recentActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {activities.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
            {t("dashboard.noActivity")}
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                    STATUS_COLOR[a.status] ?? "bg-[var(--muted-foreground)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{a.workflow_title}</span>
                    {a.step_title && (
                      <span className="text-[var(--muted-foreground)]">
                        {" "}
                        &middot; {a.step_title}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {timeAgo(a.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
