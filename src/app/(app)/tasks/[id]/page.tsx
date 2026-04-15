"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWs } from "@/lib/use-ws";
import {
  TaskTimeline,
  type TimelineStep,
} from "@/components/task/task-timeline";
import {
  StepDetail,
  type StepLog,
  type StepComment,
} from "@/components/task/step-detail";
import { useTranslation } from "@/lib/i18n/context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TaskLog {
  id: number;
  node_id: number;
  step_order: number;
  status: string;
  output: string;
  visual_html: string | null;
  visual_selection: boolean | null;
  web_response: string | null;
  hitl: boolean | null;
  approved_at: string | null;
  approval_requested_at: string | null;
  structured_output: {
    user_input?: string;
    thinking?: string;
    assistant_output: string;
  } | null;
  node_title: string;
  node_type: string;
  credential_service: string | null;
  session_id: string | null;
  provider_slug: string | null;
  user_name: string | null;
  model_slug: string | null;
  started_at: string;
  completed_at: string | null;
}

interface TaskDetail {
  id: number;
  workflow_id: number;
  workflow_title: string | null;
  total_steps: number;
  status: string;
  current_step: number;
  title: string | null;
  context: string;
  session_meta: string;
  provider_slug: string | null;
  model_slug: string | null;
  summary: string;
  logs: TaskLog[];
  registry: Record<string, string>;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeComments(raw: unknown): StepComment[] {
  const maybeList = (raw as { data?: unknown[] })?.data;
  const list: unknown[] = Array.isArray(maybeList) ? maybeList : [];

  return list
    .map((item) => {
      const parsed = item as {
        id?: number;
        comment?: string;
        created_at?: string;
        step_order?: number;
      };

      const id = parsed.id;
      if (id === undefined || id === null || Number.isNaN(Number(id)))
        return null;

      const rawComment =
        typeof parsed.comment === "string" ? parsed.comment.trim() : "";
      const authorMatch = rawComment.match(/^\[([^\]]+)\]\s*(.*)$/);
      const comment = authorMatch?.[2] ?? rawComment;
      const author = authorMatch?.[1];
      const stepOrder =
        typeof parsed.step_order === "number" ? parsed.step_order : null;
      const createdAt =
        typeof parsed.created_at === "string" ? parsed.created_at : undefined;

      return {
        id: Number(id),
        comment,
        ...(author ? { author } : {}),
        created_at:
          createdAt ??
          new Date(
            Date.now() - Math.floor(Math.random() * 1000 * 60 * 60),
          ).toISOString(),
        ...(stepOrder === null ? {} : { step_order: stepOrder }),
      };
    })
    .filter((comment): comment is StepComment => comment !== null);
}

function toDate(s: string): Date {
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return new Date(s + "Z");
}

function formatStepDuration(start: string, end: string | null): string {
  if (!end) return "";
  const diffMs = toDate(end).getTime() - toDate(start).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "";
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remainSec = sec % 60;
  if (min < 60) return remainSec > 0 ? `${min}m ${remainSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin > 0 ? `${hr}h ${remainMin}m` : `${hr}h`;
}

/** Group logs by step_order and derive timeline steps */
function buildTimelineSteps(logs: TaskLog[]): TimelineStep[] {
  const grouped = new Map<number, TaskLog[]>();
  for (const log of logs) {
    const arr = grouped.get(log.step_order) || [];
    arr.push(log);
    grouped.set(log.step_order, arr);
  }

  const steps: TimelineStep[] = [];
  for (const [stepOrder, group] of grouped) {
    const last = group[group.length - 1];
    // Duration: sum of all iterations or just the latest completed
    const totalDuration = group.reduce((sum, l) => {
      if (l.completed_at) {
        return (
          sum +
          (toDate(l.completed_at).getTime() - toDate(l.started_at).getTime())
        );
      }
      return sum;
    }, 0);

    steps.push({
      stepOrder,
      nodeId: last.node_id,
      title: last.node_title || "",
      nodeType: last.node_type,
      status: last.status,
      duration:
        totalDuration > 0
          ? formatStepDuration(
              last.started_at,
              new Date(
                toDate(last.started_at).getTime() + totalDuration,
              ).toISOString(),
            )
          : "",
      iterations: group.length > 1 ? group.length : undefined,
    });
  }

  return steps.sort((a, b) => a.stepOrder - b.stepOrder);
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function TaskDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const taskId = params.id as string;
  const initialStepParam = searchParams.get("step");
  const initialVsParam = searchParams.get("vs");
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState<number | null>(() => {
    if (!initialStepParam) return null;
    const parsed = Number(initialStepParam);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [comments, setComments] = useState<StepComment[]>([]);
  const [autoOpenVs, setAutoOpenVs] = useState(initialVsParam === "true");

  const fetchTask = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (res.ok) {
      const json = await res.json();
      setTask(json.data);
      // Auto-select current_step on first load
      if (selectedStep === null && json.data) {
        setSelectedStep(json.data.current_step);
      }
    }
    setLoading(false);
  }, [taskId, selectedStep]);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    if (res.ok) {
      const json = await res.json();
      setComments(normalizeComments(json));
    } else {
      setComments([]);
    }
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setLoading(true);
      const [taskRes, commentsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/comments`),
      ]);

      if (taskRes.ok) {
        const json = await taskRes.json();
        if (!cancelled) {
          setTask(json.data);
          setSelectedStep(
            (current) => current ?? json.data?.current_step ?? null,
          );
          setLoading(false);
        }
      } else if (!cancelled) {
        setLoading(false);
      }

      if (commentsRes.ok) {
        const json = await commentsRes.json();
        if (!cancelled) {
          setComments(normalizeComments(json));
        }
      } else if (!cancelled) {
        setComments([]);
      }
    }

    void loadPageData();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useWs((msg) => {
    if (msg.type === "task_update" && msg.task_id === Number(taskId)) {
      fetchTask();
    }
  });

  // Derived data
  const timelineSteps = useMemo(
    () => (task ? buildTimelineSteps(task.logs) : []),
    [task],
  );
  const totalSteps = task?.total_steps || 0;

  // Logs for selected step
  const selectedLogs = useMemo<StepLog[]>(() => {
    if (!task) return [];

    const stepOrderToShow = selectedStep ?? task.current_step;

    return task.logs
      .filter((l) => l.step_order === stepOrderToShow)
      .map((l) => ({
        id: l.id,
        node_id: l.node_id,
        step_order: l.step_order,
        title: l.node_title,
        node_type: l.node_type,
        status: l.status,
        output: l.output,
        structured_output: l.structured_output,
        visual_html: l.visual_html,
        visual_selection: l.visual_selection ?? null,
        web_response: l.web_response,
        hitl: l.hitl ?? null,
        approved_at: l.approved_at ?? null,
        approval_requested_at: l.approval_requested_at ?? null,
        provider_slug: l.provider_slug,
        model_slug: l.model_slug,
        user_name: l.user_name,
        credential_service: l.credential_service,
        started_at: l.started_at,
        completed_at: l.completed_at,
      }));
  }, [task, selectedStep]);

  const handleRewind = async () => {
    await fetch(`/api/tasks/${taskId}/rewind`, { method: "POST" });
    fetchTask();
  };

  const handleAddComment = async (body: string) => {
    if (!task) return;
    const stepOrder = selectedStep ?? task.current_step;

    await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: body, step_order: stepOrder }),
    });
    fetchComments();
  };

  /* Loading / error states */
  if (loading) {
    return (
      <main className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="flex h-[calc(100vh-3rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("tasks.taskNotFound")}
        </p>
        <Link
          href="/tasks"
          className="text-sm text-brand-blue-600 hover:underline"
        >
          &larr; {t("tasks.backToList")}
        </Link>
      </main>
    );
  }

  const taskTitle =
    task.workflow_title ?? t("tasks.taskFallback", { id: task.id });

  const taskProvider = task.provider_slug
    ? (task.registry?.[task.provider_slug] ?? task.provider_slug)
    : null;
  const taskModel = task.model_slug
    ? (task.registry?.[task.model_slug] ?? task.model_slug)
    : null;

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[320px_minmax(0,1fr)]">
      {/* Left: Timeline */}
      <TaskTimeline
        taskTitle={taskTitle}
        taskSubtitle={task.title ?? undefined}
        taskStatus={task.status}
        provider={taskProvider}
        model={taskModel}
        steps={timelineSteps}
        currentStep={task.current_step}
        totalSteps={totalSteps}
        selectedStep={selectedStep ?? task.current_step}
        onSelectStep={setSelectedStep}
        onRewind={task.status === "running" ? handleRewind : undefined}
      />

      {/* Right: Step detail */}
      <StepDetail
        logs={selectedLogs}
        taskId={task.id}
        workflowId={task.workflow_id}
        taskStatus={task.status}
        registry={task.registry ?? {}}
        comments={comments.filter(
          (c) => c.step_order === (selectedStep ?? task.current_step),
        )}
        onAddComment={handleAddComment}
        onRefresh={fetchTask}
        autoOpenVs={autoOpenVs}
        onVsOpened={() => setAutoOpenVs(false)}
      />
    </div>
  );
}
