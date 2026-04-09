"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  ListTodo,
  Pause,
  Play,
  Workflow,
  XCircle,
} from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((json) => {
        const all: Task[] = json.data ?? [];
        setTasks(all.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10">
        <p className="text-sm text-[var(--muted)]">Agent Workflow Engine</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">OmegaRod</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          체인(Workflow)과 태스크(Task)를 한 화면에서 만들고, 실행하고, 기록을
          추적합니다.
        </p>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-[var(--muted)]" />
            <h2 className="text-lg font-semibold">최근 태스크</h2>
          </div>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
          >
            전체 보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
              로딩 중...
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
              아직 태스크가 없습니다.
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
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-[var(--card-shadow-hover)]">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-sm text-[var(--muted)]">
                            #{task.id}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {task.chain_title ?? `Chain #${task.chain_id}`}
                            </p>
                          </div>
                          <StatusBadge status={task.status} />
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          {task.status === "completed"
                            ? task.updated_at
                            : task.created_at}
                        </span>
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
                          {uniqueCompleted}/{totalSteps}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[var(--muted)]" />
          <h2 className="text-lg font-semibold">바로가기</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            {
              href: "/chains",
              title: "체인 관리",
              desc: "워크플로 체인 생성 및 편집",
              Icon: Workflow,
            },
            {
              href: "/tasks",
              title: "태스크",
              desc: "실행 상태 실시간 확인",
              Icon: ListTodo,
            },
            {
              href: "/tutorial",
              title: "튜토리얼",
              desc: "OmegaRod 사용 가이드",
              Icon: BookOpen,
            },
            {
              href: "/docs",
              title: "API 문서",
              desc: "REST API 레퍼런스",
              Icon: FileText,
            },
          ].map(({ href, title, desc, Icon }) => (
            <Link key={href} href={href} className="block">
              <Card className="h-full transition-shadow hover:shadow-[var(--card-shadow-hover)]">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[var(--muted)]" />
                      {title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    {desc}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
