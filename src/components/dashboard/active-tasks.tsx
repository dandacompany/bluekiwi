"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/context";

interface ActiveTask {
  id: number;
  workflow_title: string;
  status: string;
  current_step: number;
  total_steps: number;
  current_node_type: string;
}

interface ActiveTasksProps {
  tasks: ActiveTask[];
}

export function ActiveTasks({ tasks }: ActiveTasksProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{t("dashboard.activeTasksList")}</span>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-xs font-normal text-brand-blue-700 hover:underline"
          >
            {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
            {t("dashboard.noActiveTasks")}
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const progress =
                task.total_steps > 0
                  ? Math.round((task.current_step / task.total_steps) * 100)
                  : 0;

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block rounded-lg border border-[var(--border)] p-3 transition-shadow hover:shadow-card"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        task.status === "in_progress"
                          ? "bg-brand-blue-600"
                          : "bg-kiwi-600"
                      }`}
                    />
                    <span className="truncate text-sm font-medium">
                      {task.workflow_title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className="h-full rounded-full bg-brand-blue-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
                      {task.current_step}/{task.total_steps}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
