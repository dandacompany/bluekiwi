"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useWs } from "@/lib/use-ws";

import {
  CheckCircle,
  Clock,
  ListTodo,
  Pause,
  Play,
  Trash2,
  XCircle,
} from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskLog {
  id: number;
  step_order: number;
  status: string;
  output: string;
}

interface Task {
  id: number;
  chain_id: number;
  chain_title: string | null;
  status: string;
  current_step: number;
  context: string;
  logs: TaskLog[];
  created_at: string;
  updated_at: string;
}

type TaskStatus = "pending" | "running" | "completed" | "failed";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "대기",
  running: "실행 중",
  completed: "완료",
  failed: "실패",
};

function StatusBadge({ status }: { status: string }) {
  const s = status as TaskStatus;
  const Icon =
    s === "completed"
      ? CheckCircle
      : s === "failed"
        ? XCircle
        : s === "running"
          ? Play
          : Pause;

  const className =
    s === "running"
      ? "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]"
      : s === "completed"
        ? "border-[color:var(--accent)] bg-transparent text-[var(--accent-dark)]"
        : s === "failed"
          ? "border-[color:var(--destructive)] bg-[var(--destructive-light)] text-[var(--destructive-dark)]"
          : "border-[var(--border)] bg-transparent text-[var(--muted)]";

  return (
    <Badge className={className}>
      <Icon className="h-3.5 w-3.5" />
      {STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const deleteTask = async (taskId: number) => {
    if (!confirm(`태스크 #${taskId}를 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/tasks?${params}`);
    const json = await res.json();
    setTasks(json.data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // WebSocket 실시간 업데이트
  useWs((msg) => {
    if (msg.type === "task_update") {
      fetchTasks();
    }
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-[var(--muted)]" />
          <h1 className="text-2xl font-bold tracking-tight">태스크</h1>
        </div>
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          홈
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <Tabs
          value={filter || "all"}
          onValueChange={(v) => setFilter(v === "all" ? "" : v)}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="running">실행 중</TabsTrigger>
            <TabsTrigger value="completed">완료</TabsTrigger>
            <TabsTrigger value="failed">실패</TabsTrigger>
            <TabsTrigger value="pending">대기</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-[var(--muted)]">
          WebSocket 실시간 업데이트
        </span>
      </div>

      {loading && tasks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            로딩 중...
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            태스크가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const uniqueCompleted = new Set(
              task.logs
                .filter((l) => l.status === "completed")
                .map((l) => l.step_order),
            ).size;
            const totalSteps = Math.max(
              ...task.logs.map((l) => l.step_order),
              1,
            );

            const fillColor =
              task.status === "failed"
                ? "bg-[var(--destructive)]"
                : task.status === "pending"
                  ? "bg-[var(--muted)]"
                  : "bg-[var(--accent)]";

            return (
              <Card
                key={task.id}
                className="transition-shadow hover:shadow-[var(--card-shadow-hover)]"
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm text-[var(--muted)]">
                          #{task.id}
                        </span>
                        <p className="truncate text-sm font-semibold">
                          {task.chain_title ?? `Chain #${task.chain_id}`}
                        </p>
                        <StatusBadge status={task.status} />
                      </div>
                      {task.context && (
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {task.context}
                        </p>
                      )}
                    </Link>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <Clock className="h-3.5 w-3.5" />
                        {task.status === "completed"
                          ? task.updated_at
                          : task.created_at}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                        onClick={() => deleteTask(task.id)}
                        title="삭제"
                        aria-label={`태스크 #${task.id} 삭제`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--warm-light)]">
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
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {uniqueCompleted}/{totalSteps} steps
                    </span>
                  </div>

                  {task.logs.length > 0 && (
                    <p className="mt-3 truncate text-xs text-[var(--muted)]">
                      Step {task.logs[task.logs.length - 1].step_order}:{" "}
                      {task.logs[task.logs.length - 1].output.slice(0, 100)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
