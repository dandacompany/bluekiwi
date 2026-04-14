"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWs } from "@/lib/use-ws";
import { useTranslation } from "@/lib/i18n/context";
import { useListFetch } from "@/lib/use-list-fetch";
import { useDeleteHandler } from "@/lib/use-delete-handler";

import {
  CheckCircle,
  Clock,
  ListTodo,
  Pause,
  Play,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TaskLog {
  id: number;
  step_order: number;
  status: string;
  output: string;
}

interface Task {
  id: number;
  workflow_id: number;
  workflow_title: string | null;
  total_steps: number;
  status: string;
  current_step: number;
  title: string | null;
  context: string;
  logs: TaskLog[];
  created_at: string;
  updated_at: string;
}

function formatTaskRelativeTime(
  date: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const now = Date.now();
  const target = new Date(date).getTime();
  const diffMin = Math.floor((now - target) / 60_000);

  if (diffMin < 1) return t("dashboard.timeJustNow");
  if (diffMin < 60) return t("dashboard.timeMinutesAgo", { n: diffMin });

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("dashboard.timeHoursAgo", { n: diffHr });

  const diffDay = Math.floor(diffHr / 24);
  return t("dashboard.timeDaysAgo", { n: diffDay });
}

function summarizeTaskOutput(output: string, maxLength = 140): string {
  const normalized = output.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "timed_out";

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const s = status as TaskStatus;

  const STATUS_LABEL: Record<TaskStatus, string> = {
    pending: t("tasks.pending"),
    running: t("tasks.running"),
    completed: t("tasks.completed"),
    failed: t("tasks.failed"),
    timed_out: t("tasks.timedOut"),
  };

  const Icon =
    s === "completed"
      ? CheckCircle
      : s === "failed"
        ? XCircle
        : s === "running"
          ? Play
          : s === "timed_out"
            ? Timer
            : Pause;

  const className =
    s === "running"
      ? "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700"
      : s === "completed"
        ? "border-brand-blue-600/20 bg-transparent text-brand-blue-700"
        : s === "failed"
          ? "border-[color:var(--destructive)] bg-destructive/10 text-[var(--destructive)]"
          : s === "timed_out"
            ? "border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]";

  return (
    <Badge className={className}>
      <Icon className="h-3.5 w-3.5" />
      {STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

export default function TasksPage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const workflowFilter = searchParams.get("workflow_id");

  const {
    data: tasks,
    loading,
    refetch: fetchTasks,
  } = useListFetch<Task>(() => {
    const params = new URLSearchParams();
    if (workflowFilter) params.set("workflow_id", workflowFilter);
    if (filter) params.set("status", filter);
    return `/api/tasks?${params}`;
  }, [filter, workflowFilter]);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<Task>({
      endpoint: (target) => `/api/tasks/${target.id}`,
      onSuccess: fetchTasks,
      fallbackMessage: t("common.deleteFailed"),
    });

  // WebSocket real-time updates
  useWs((msg) => {
    if (msg.type === "task_update") {
      fetchTasks();
    }
  });

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("tasks.title")}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-7xl w-full px-6 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  value: "",
                  label: t("tasks.all"),
                  active: "bg-[var(--foreground)] text-[var(--background)]",
                },
                {
                  value: "running",
                  label: t("tasks.running"),
                  active: "bg-brand-blue-600 text-white",
                },
                {
                  value: "completed",
                  label: t("tasks.completed"),
                  active: "bg-kiwi-600 text-white",
                },
                {
                  value: "failed",
                  label: t("tasks.failed"),
                  active: "bg-[var(--destructive)] text-white",
                },
                {
                  value: "timed_out",
                  label: t("tasks.timedOut"),
                  active: "bg-amber-500 text-white",
                },
                {
                  value: "pending",
                  label: t("tasks.pending"),
                  active: "bg-[var(--muted-foreground)] text-white",
                },
              ] as const
            ).map(({ value, label, active }) => {
              const isActive = filter === value;
              return (
                <button
                  key={value || "all"}
                  onClick={() => setFilter(value)}
                  className={`inline-flex items-center rounded-full border px-3.5 py-1 text-sm font-medium transition-all ${
                    isActive
                      ? `${active} border-transparent shadow-sm`
                      : "border-border/70 bg-transparent text-[var(--muted-foreground)] hover:border-border hover:bg-surface-soft hover:text-[var(--foreground)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">
            {t("tasks.wsRealtime")}
          </span>
        </div>

        {loading && tasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("common.loading")}
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={t("tasks.empty")}
            description={t("tasks.emptyDesc")}
          />
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const uniqueCompleted = new Set(
                task.logs
                  .filter((l) => l.status === "completed")
                  .map((l) => l.step_order),
              ).size;
              const totalSteps = task.total_steps || 1;

              const fillColor =
                task.status === "failed"
                  ? "bg-[var(--destructive)]"
                  : task.status === "timed_out"
                    ? "bg-amber-400"
                    : task.status === "pending"
                      ? "bg-[var(--muted)]"
                      : "bg-brand-blue-600";

              return (
                <Card
                  key={task.id}
                  className="overflow-hidden border-border/80 transition-shadow hover:shadow-soft"
                >
                  <div className="border-b border-border/70 bg-kiwi-100/50 px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm text-[var(--muted-foreground)]">
                            #{task.id}
                          </span>
                          <p className="truncate text-base font-semibold text-[var(--foreground)]">
                            {task.workflow_title ??
                              t("tasks.workflowFallback", {
                                id: task.workflow_id,
                              })}
                          </p>
                          <StatusBadge status={task.status} t={t} />
                        </div>
                        {(task.title ?? task.context) && (
                          <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
                            {task.title ?? task.context.slice(0, 80)}
                          </p>
                        )}
                      </Link>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTaskRelativeTime(
                            task.status === "completed"
                              ? task.updated_at
                              : task.created_at,
                            t,
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[var(--destructive)] hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(task)}
                          title={t("common.delete")}
                          aria-label={`${t("common.delete")} #${task.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <CardContent className="px-5 py-4">
                    <Link href={`/tasks/${task.id}`} className="block">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
                          <div
                            className={`h-full rounded-full transition-all ${fillColor}`}
                            style={{
                              width:
                                task.logs.length > 0
                                  ? `${(uniqueCompleted / totalSteps) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-medium text-[var(--muted-foreground)]">
                          {uniqueCompleted}/{totalSteps} {t("tasks.steps")}
                        </span>
                      </div>

                      {task.logs.length > 0 && (
                        <div className="mt-3 rounded-[var(--radius-sm)] border border-border/70 bg-surface-soft/40 px-3 py-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                            {t("tasks.stepLabel", {
                              step: task.logs[task.logs.length - 1].step_order,
                            })}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--foreground)]">
                            {summarizeTaskOutput(
                              task.logs[task.logs.length - 1].output,
                              180,
                            )}
                          </p>
                        </div>
                      )}
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <DeleteConfirmDialog
          target={deleteTarget}
          title={t("tasks.deleteTitle")}
          description={t("tasks.deleteDescription", {
            id: deleteTarget?.id ?? 0,
          })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
