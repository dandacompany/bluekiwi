"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock4,
  FileText,
  GitBranch,
  HardDrive,
  ListTree,
  Pencil,
  Play,
  RotateCcw,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useWs } from "@/lib/use-ws";
import { useTranslation } from "@/lib/i18n/context";

interface WorkflowNode {
  id: number;
  step_order: number;
  node_type: "action" | "gate" | "loop";
  title: string;
  instruction_id: number | null;
  resolved_instruction: string;
  hitl: boolean;
  visual_selection: boolean;
}

interface WorkflowDetail {
  id: number;
  title: string;
  description: string;
  version: string;
  parent_workflow_id: number | null;
  family_root_id: number;
  is_active: boolean;
  evaluation_contract: string | null;
  owner_id: number;
  folder_id: number;
  visibility_override: "personal" | null;
  created_at: string;
  updated_at: string;
  nodes: WorkflowNode[];
}

interface MeResponse {
  userId: number;
  username: string;
  role: "viewer" | "editor" | "admin" | "superuser";
}

interface VersionRow {
  id: number;
  title: string;
  version: string;
  is_active: boolean;
  parent_workflow_id: number | null;
  family_root_id: number;
  created_at: string;
  updated_at: string;
}

interface VersionsResponse {
  family_root_id: number;
  active_version_id: number | null;
  versions: VersionRow[];
}

interface TaskLogHeader {
  step_order: number;
  status: string;
}

interface TaskItem {
  id: number;
  workflow_id: number;
  workflow_title: string | null;
  status: string;
  current_step: number;
  context: string;
  logs: TaskLogHeader[];
  created_at: string;
  updated_at: string;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString();
}

function taskStatusLabel(
  status: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (status === "completed") return t("tasks.completed");
  if (status === "running") return t("tasks.running");
  if (status === "failed") return t("tasks.failed");
  if (status === "pending") return t("tasks.pending");
  return status;
}

function taskStatusClass(status: string) {
  if (status === "running") {
    return "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700";
  }
  if (status === "completed") {
    return "border-brand-blue-600/20 bg-transparent text-brand-blue-700";
  }
  if (status === "failed") {
    return "border-[var(--destructive)] bg-destructive/10 text-[var(--destructive)]";
  }
  return "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]";
}

const STATUS_ICON_MAP = {
  completed: RotateCcw,
  failed: Clock4,
  running: Play,
  pending: ListTree,
} as const;

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const Icon =
    STATUS_ICON_MAP[(status as keyof typeof STATUS_ICON_MAP) ?? "pending"];

  return (
    <Badge className={taskStatusClass(status)}>
      <Icon className="h-3.5 w-3.5" />
      {taskStatusLabel(status, t)}
    </Badge>
  );
}

function nodeTypeLabel(
  type: "action" | "gate" | "loop",
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (type === "gate") return t("editor.gate");
  if (type === "loop") return t("editor.loop");
  return t("editor.action");
}

function nodeTypeBadgeClass(type: "action" | "gate" | "loop") {
  if (type === "gate") {
    return "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700";
  }
  if (type === "loop") {
    return "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]";
  }
  return "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700";
}

function NodeCard({
  node,
  t,
}: {
  node: WorkflowNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className={nodeTypeBadgeClass(node.node_type)}>
              {nodeTypeLabel(node.node_type, t)}
            </Badge>
            <p className="text-sm font-medium">
              {node.step_order}. {node.title}
            </p>
            {node.hitl && (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-700"
              >
                HITL
              </Badge>
            )}
            {node.visual_selection && (
              <Badge
                variant="outline"
                className="border-kiwi-500 text-kiwi-700"
              >
                Visual
              </Badge>
            )}
          </div>
          <Badge variant="outline">
            {t("workflows.nodeStep", { step: node.step_order })}
          </Badge>
        </div>
        <p className="line-clamp-3 text-xs text-[var(--muted-foreground)]">
          {node.resolved_instruction || t("workflows.noInstruction")}
        </p>
      </CardContent>
    </Card>
  );
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const workflowId = Number(params.id);
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState("history");
  const historySectionRef = useRef<HTMLDivElement | null>(null);
  const [versions, setVersions] = useState<VersionsResponse | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.user) setMe(j.user as MeResponse);
      })
      .catch(() => {});
  }, []);

  const canEdit =
    !!me &&
    !!workflow &&
    (me.userId === workflow.owner_id || me.role === "superuser");

  const fetchWorkflow = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/workflows/${workflowId}`);
    if (!res.ok) {
      setWorkflow(null);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setWorkflow(json.data as WorkflowDetail);
    setLoading(false);
  }, [workflowId]);

  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true);
    const res = await fetch(`/api/workflows/${workflowId}/versions`);
    if (!res.ok) {
      setVersions(null);
      setVersionsLoading(false);
      return;
    }
    const json = await res.json();
    setVersions(json.data as VersionsResponse);
    setVersionsLoading(false);
  }, [workflowId]);

  const activateVersion = async (id: number) => {
    const res = await fetch(`/api/workflows/${id}/activate`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error(t("workflows.activateFailed"));
      return;
    }
    toast.success(t("workflows.activated"));
    await Promise.all([fetchVersions(), fetchWorkflow()]);
  };

  const deactivateVersion = async (id: number) => {
    const res = await fetch(`/api/workflows/${id}/deactivate`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error(t("workflows.deactivateFailed"));
      return;
    }
    toast.success(t("workflows.deactivated"));
    await Promise.all([fetchVersions(), fetchWorkflow()]);
  };

  const fetchTasks = useCallback(async () => {
    setTaskLoading(true);
    const params = new URLSearchParams();
    params.set("workflow_id", String(workflowId));
    if (taskStatusFilter) params.set("status", taskStatusFilter);
    if (taskSearch.trim()) params.set("q", taskSearch.trim());
    const res = await fetch(`/api/tasks?${params}`);
    if (!res.ok) {
      setTasks([]);
      setTaskLoading(false);
      return;
    }
    const json = await res.json();
    setTasks((json.data as TaskItem[]) ?? []);
    setTaskLoading(false);
  }, [workflowId, taskStatusFilter, taskSearch]);

  useEffect(() => {
    if (!Number.isFinite(workflowId)) {
      setLoading(false);
      setTaskLoading(false);
      return;
    }

    // Reset data to avoid stale rendering while the new version loads.
    // Every section (hero, tabs, tasks, versions) is keyed on workflowId,
    // so when the dropdown navigates to a different version we want the
    // UI to visibly reset instead of showing the previous version's rows.
    setWorkflow(null);
    setTasks([]);
    setVersions(null);

    void fetchWorkflow();
    void fetchTasks();
    void fetchVersions();
  }, [workflowId, fetchWorkflow, fetchTasks, fetchVersions]);

  useWs(() => {
    void fetchTasks();
  });

  const evaluationContract = useMemo(() => {
    if (!workflow?.evaluation_contract) return "";
    try {
      return JSON.stringify(JSON.parse(workflow.evaluation_contract), null, 2);
    } catch {
      return workflow.evaluation_contract;
    }
  }, [workflow]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [tasks],
  );

  const taskSummary = useMemo(
    () => ({
      total: sortedTasks.length,
      running: sortedTasks.filter((task) => task.status === "running").length,
      completed: sortedTasks.filter((task) => task.status === "completed")
        .length,
      failed: sortedTasks.filter((task) => task.status === "failed").length,
    }),
    [sortedTasks],
  );

  const previewTasks = useMemo(() => sortedTasks.slice(0, 3), [sortedTasks]);

  const runWorkflow = async () => {
    if (!workflow) return;
    setStarting(true);
    try {
      // The dropdown now navigates to the selected version, so by the time
      // Run is pressed the page is already showing that version. Starting
      // the currently viewed workflow is the only sensible action.
      const res = await fetch("/api/tasks/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: workflow.id }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(t("workflows.inactiveStartBlocked"));
          return;
        }
        toast.error(t("workflows.runFailed"));
        return;
      }
      const json = await res.json();
      const taskId = json?.data?.task_id;
      toast.success(t("workflows.runStarted", { id: taskId ?? "" }));
      await fetchTasks();
      if (typeof taskId === "number") {
        router.push(`/tasks/${taskId}`);
      }
    } finally {
      setStarting(false);
    }
  };

  if (!Number.isFinite(workflowId)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="text-sm text-[var(--destructive)]">
          {t("workflows.invalidId")}
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (!workflow) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("workflows.notFound")}
        </p>
        <Link href="/workflows" className="text-sm text-brand-blue-600">
          ← {t("workflows.backToList")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <section className="mb-5 rounded-xl border border-[var(--border)] bg-surface-soft p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {workflow.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {workflow.description || t("workflows.noDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {versions && versions.versions.length > 1 && (
              <select
                value={workflow.id}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  if (nextId && nextId !== workflow.id) {
                    router.push(`/workflows/${nextId}`);
                  }
                }}
                className="h-9 rounded-md border border-[var(--border)] bg-background px-2 text-xs"
                aria-label={t("workflows.pickVersion")}
              >
                {versions.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                    {v.is_active ? " ✓" : ` (${t("workflows.inactiveBadge")})`}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="secondary"
              onClick={() => router.push(`/workflows/${workflow.id}/edit`)}
              disabled={!canEdit}
              title={canEdit ? undefined : t("ownership.cantEdit")}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t("workflows.goEdit")}
            </Button>
            <Button onClick={runWorkflow} disabled={starting}>
              <Play className="mr-2 h-4 w-4" />
              {starting ? t("common.loading") : t("workflows.run")}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-[var(--muted-foreground)] md:grid-cols-3">
          <p className="inline-flex items-center gap-2">
            <HardDrive className="h-3.5 w-3.5" />
            {t("workflows.version")}: {workflow.version}
            <Badge
              className={
                workflow.is_active
                  ? "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700"
                  : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
              }
            >
              {workflow.is_active
                ? t("workflows.activeBadge")
                : t("workflows.inactiveBadge")}
            </Badge>
            <VisibilityBadge
              visibility={workflow.visibility_override ?? "inherit"}
              iconOnly
            />
          </p>
          <p className="inline-flex items-center gap-2">
            <ListTree className="h-3.5 w-3.5" />
            {t("workflows.nodeCount")} {workflow.nodes.length}
          </p>
          <p className="inline-flex items-center gap-2">
            <Clock4 className="h-3.5 w-3.5" />
            {t("workflows.updatedAt")} {formatDateTime(workflow.updated_at)}
          </p>
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/80 bg-background/80">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {t("workflows.quickTasksTitle")}
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {t("workflows.quickTasksDesc")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/tasks?workflow_id=${workflow.id}`}>
                  {t("workflows.viewAllTasks")}
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: t("workflows.totalTasksLabel"),
                  value: taskSummary.total,
                },
                { label: t("tasks.running"), value: taskSummary.running },
                {
                  label: t("tasks.completed"),
                  value: taskSummary.completed,
                },
                { label: t("tasks.failed"), value: taskSummary.failed },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/70 bg-surface-soft/60 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-background/80">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {t("workflows.recentTasks")}
              </p>
            </div>

            {taskLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("common.loading")}
              </p>
            ) : previewTasks.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t("tasks.empty")}
                description={t("workflows.noTasks")}
              />
            ) : (
              <div className="space-y-3">
                {previewTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-2xl border border-border/70 bg-surface-soft/45 px-4 py-3 transition-colors hover:border-brand-blue-200 hover:bg-brand-blue-100/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {task.workflow_title ??
                            t("tasks.workflowFallback", {
                              id: task.workflow_id,
                            })}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          #{task.id} ·{" "}
                          {task.context || formatDateTime(task.updated_at)}
                        </p>
                      </div>
                      <StatusBadge status={task.status} t={t} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div ref={historySectionRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="history">{t("workflows.history")}</TabsTrigger>
            <TabsTrigger value="nodes">{t("workflows.nodesTab")}</TabsTrigger>
            <TabsTrigger value="versions">
              {t("workflows.versionsTab")}
            </TabsTrigger>
            <TabsTrigger value="meta">{t("workflows.meta")}</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-sm text-[var(--muted-foreground)]">
                {
                  t("workflows.runningTasks", {
                    count: tasks.length,
                  }) as unknown as string
                }
              </div>
              <div className="flex w-full max-w-sm items-center gap-2">
                <Input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder={t("common.search")}
                  aria-label={t("common.search")}
                />
                <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={taskStatusFilter === "" ? "default" : "outline"}
                onClick={() => setTaskStatusFilter("")}
              >
                {t("tasks.all")}
              </Button>
              <Button
                size="sm"
                variant={taskStatusFilter === "running" ? "default" : "outline"}
                onClick={() => setTaskStatusFilter("running")}
              >
                {t("tasks.running")}
              </Button>
              <Button
                size="sm"
                variant={
                  taskStatusFilter === "completed" ? "default" : "outline"
                }
                onClick={() => setTaskStatusFilter("completed")}
              >
                {t("tasks.completed")}
              </Button>
              <Button
                size="sm"
                variant={taskStatusFilter === "failed" ? "default" : "outline"}
                onClick={() => setTaskStatusFilter("failed")}
              >
                {t("tasks.failed")}
              </Button>
              <Button
                size="sm"
                variant={taskStatusFilter === "pending" ? "default" : "outline"}
                onClick={() => setTaskStatusFilter("pending")}
              >
                {t("tasks.pending")}
              </Button>
            </div>

            {taskLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  {t("common.loading")}
                </CardContent>
              </Card>
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t("tasks.empty")}
                description={t("workflows.noTasks")}
              />
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const completedSteps = new Set(
                    task.logs
                      .filter((l) => l.status === "completed")
                      .map((l) => l.step_order),
                  ).size;
                  const totalSteps = Math.max(
                    ...task.logs.map((l) => l.step_order),
                    1,
                  );
                  const fillPercent =
                    task.logs.length > 0
                      ? (completedSteps / totalSteps) * 100
                      : 0;
                  return (
                    <Card
                      key={task.id}
                      className="transition-shadow hover:shadow-soft"
                    >
                      <CardContent className="p-4">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="min-w-0 flex-1"
                          >
                            <p className="truncate text-sm font-semibold">
                              {task.workflow_title ??
                                t("tasks.workflowFallback", {
                                  id: task.workflow_id,
                                })}
                            </p>
                            <p className="truncate text-xs text-[var(--muted-foreground)]">
                              {task.context}
                            </p>
                          </Link>
                          <StatusBadge status={task.status} t={t} />
                        </div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          <Clock4 className="h-3.5 w-3.5" />
                          <span>
                            #{task.id} ·{" "}
                            {task.status === "completed"
                              ? formatDateTime(task.updated_at)
                              : formatDateTime(task.created_at)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                          <div
                            className={`h-full rounded-full transition-all ${
                              task.status === "failed"
                                ? "bg-destructive"
                                : task.status === "pending"
                                  ? "bg-[var(--muted)]"
                                  : "bg-brand-blue-600"
                            }`}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-[var(--muted-foreground)]">
                          {completedSteps}/{totalSteps} {t("tasks.steps")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="nodes">
            {workflow.nodes.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title={t("workflows.noNodes")}
                description={t("workflows.noNodesDesc")}
              />
            ) : (
              <div className="space-y-3">
                {workflow.nodes.map((node) => (
                  <NodeCard key={node.id} node={node} t={t} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="versions">
            <Card>
              <CardContent className="space-y-4 p-4 text-sm">
                <div>
                  <h2 className="text-base font-semibold">
                    {t("workflows.versionHistoryTitle")}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {t("workflows.versionHistoryDesc")}
                  </p>
                </div>

                {versionsLoading ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("common.loading")}
                  </p>
                ) : !versions || versions.versions.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("workflows.empty")}
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-[var(--border)]">
                      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                        <span>{t("workflows.version")}</span>
                        <span>{t("workflows.createdAt")}</span>
                        <span>{t("workflows.lineage")}</span>
                        <span />
                        <span className="text-right">
                          {t("workflows.actions")}
                        </span>
                      </div>
                      {versions.versions.map((v) => {
                        const isCurrent = v.id === workflow.id;
                        return (
                          <div
                            key={v.id}
                            className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-xs last:border-b-0 ${
                              isCurrent ? "bg-brand-blue-50" : ""
                            }`}
                          >
                            <div className="inline-flex items-center gap-2">
                              <Link
                                href={`/workflows/${v.id}`}
                                className="font-medium text-brand-blue-600 hover:underline"
                              >
                                {v.version}
                              </Link>
                              {isCurrent && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {t("workflows.currentlyViewing")}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[var(--muted-foreground)]">
                              {formatDateTime(v.created_at)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
                              <GitBranch className="h-3 w-3" />
                              {v.parent_workflow_id
                                ? `#${v.parent_workflow_id}`
                                : t("workflows.noParent")}
                            </span>
                            <Badge
                              className={
                                v.is_active
                                  ? "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700"
                                  : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
                              }
                            >
                              {v.is_active ? (
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("workflows.activeBadge")}
                                </span>
                              ) : (
                                t("workflows.inactiveBadge")
                              )}
                            </Badge>
                            <div className="flex justify-end gap-1">
                              {v.is_active ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deactivateVersion(v.id)}
                                >
                                  {t("workflows.deactivate")}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => activateVersion(v.id)}
                                >
                                  {t("workflows.activate")}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {t("workflows.lineageDesc")}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta">
            <Card>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{t("workflows.metaId")}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {workflow.id}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    {t("workflows.metaVersion")}
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {workflow.version}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    {t("workflows.metaParent")}
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {workflow.parent_workflow_id
                      ? String(workflow.parent_workflow_id)
                      : t("workflows.metaNoParent")}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    {t("workflows.metaContract")}
                  </p>
                  {evaluationContract ? (
                    <pre className="overflow-auto rounded-lg border border-[var(--border)] bg-slate-950 p-3 text-xs text-slate-100">
                      {evaluationContract}
                    </pre>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("workflows.noEvaluation")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
