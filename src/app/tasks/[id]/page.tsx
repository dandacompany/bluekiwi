"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWs } from "@/lib/use-ws";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Repeat,
  Zap,
} from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TaskLog {
  id: number;
  node_id: number;
  step_order: number;
  status: string;
  output: string;
  visual_html: string | null;
  web_response: string | null;
  structured_output: {
    user_input?: string;
    thinking?: string;
    assistant_output: string;
  } | null;
  node_title: string;
  node_type: string;
  credential_service: string | null;
  session_id: string | null;
  agent_id: string | null;
  user_name: string | null;
  model_id: string | null;
  started_at: string;
  completed_at: string | null;
}

interface SessionMeta {
  project_dir?: string;
  user_name?: string;
  agent?: string;
  git_remote?: string;
  git_branch?: string;
  model_id?: string;
  os?: string;
  started_at?: string;
}

interface TaskDetail {
  id: number;
  chain_id: number;
  chain_title: string | null;
  status: string;
  current_step: number;
  context: string;
  session_meta: string;
  summary: string;
  logs: TaskLog[];
  created_at: string;
  updated_at: string;
}

type TaskStatus = "pending" | "running" | "completed" | "failed";

function getStatusBadgeClass(status: string) {
  const s = status as TaskStatus;
  if (s === "running") {
    return "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]";
  }
  if (s === "completed") {
    return "border-[color:var(--accent)] bg-transparent text-[var(--accent-dark)]";
  }
  if (s === "failed") {
    return "border-[color:var(--destructive)] bg-[var(--destructive-light)] text-[var(--destructive-dark)]";
  }
  return "border-[var(--border)] bg-transparent text-[var(--muted)]";
}

function StatusIcon({ status }: { status: string }) {
  const s = status as TaskStatus;
  if (s === "completed") return <CheckCircle2 className="h-4 w-4" />;
  if (s === "failed") return <AlertCircle className="h-4 w-4" />;
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
  return <Clock className="h-4 w-4" />;
}

function NodeTypeBadge({ nodeType }: { nodeType: string }) {
  const t = nodeType as "action" | "gate" | "loop";
  const config =
    t === "gate"
      ? {
          Icon: MessageSquare,
          className:
            "border-transparent bg-[var(--warm-light)] text-[var(--foreground)]",
          label: "gate",
        }
      : t === "loop"
        ? {
            Icon: Repeat,
            className:
              "border-[var(--border)] bg-transparent text-[var(--muted)]",
            label: "loop",
          }
        : {
            Icon: Zap,
            className:
              "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]",
            label: "action",
          };

  return (
    <Badge className={config.className}>
      <config.Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function toDate(s: string): Date {
  // PostgreSQL: "2026-04-08T05:49:22.080Z" (이미 Z 포함)
  // SQLite 레거시: "2026-04-08 05:49:22" (Z 없음)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return new Date(s + "Z");
}

function formatElapsed(start: string, end: string): string {
  const diffMs = toDate(end).getTime() - toDate(start).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "-";
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 1) return "1분 미만";
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function formatStepDuration(start: string, end: string | null): string {
  if (!end) return "";
  const diffMs = toDate(end).getTime() - toDate(start).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "";
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const remainSec = sec % 60;
  if (min < 60) return remainSec > 0 ? `${min}분 ${remainSec}초` : `${min}분`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin > 0 ? `${hr}시간 ${remainMin}분` : `${hr}시간`;
}

function formatDateTime(s: string): string {
  const d = toDate(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function parseSessionMeta(raw: string): SessionMeta {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function VisualViewer({ html }: { html: string }) {
  return (
    <div className="mt-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            비주얼 보기
          </Button>
        </DialogTrigger>
        <DialogContent className="overflow-hidden p-0">
          <DialogHeader className="border-b border-[var(--border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>비주얼 뷰어</DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  닫기
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="p-5">
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white">
                <iframe
                  srcDoc={html}
                  className="w-full min-h-[600px] bg-white"
                  sandbox="allow-scripts"
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebResponseForm({
  taskId,
  nodeId,
  existingResponse,
  onSubmit,
}: {
  taskId: number;
  nodeId: number;
  existingResponse: string | null;
  onSubmit: () => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  if (existingResponse) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingResponse);
    } catch {
      parsed = existingResponse;
    }
    return (
      <div className="mt-3 rounded-[var(--radius)] border border-[color:var(--accent)] bg-[var(--accent-light)] p-3">
        <p className="mb-1 text-xs font-medium text-[var(--accent-dark)]">
          웹 응답 완료
        </p>
        <p className="text-sm text-[var(--foreground)]">{String(parsed)}</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSending(true);
    await fetch(`/api/tasks/${taskId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, response: input.trim() }),
    });
    setSending(false);
    setInput("");
    onSubmit();
  };

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[color:var(--warm)] bg-[var(--warm-light)] p-3">
      <p className="mb-2 text-xs font-medium text-[var(--foreground)]">
        응답 대기 중 — 여기서 직접 응답하거나 터미널에서 /or-next로 진행
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="응답을 입력하세요..."
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <Button
          onClick={handleSubmit}
          disabled={sending || !input.trim()}
          size="sm"
        >
          {sending ? "..." : "전송"}
        </Button>
      </div>
    </div>
  );
}

/** Structured Output 뷰 컴포넌트 */
function StructuredOutputView({
  so,
}: {
  so: NonNullable<TaskLog["structured_output"]>;
}) {
  const [showThinking, setShowThinking] = useState(false);
  const proseClass =
    "prose prose-sm dark:prose-invert prose-headings:text-base prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-3 prose-pre:bg-gray-800 prose-pre:text-gray-200 prose-strong:text-[var(--foreground)] max-w-none";

  return (
    <div className="text-sm text-[var(--foreground)] bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
      {/* User Input */}
      {so.user_input && (
        <div className="px-5 pt-4 pb-3 bg-[var(--warm-light)] border-b border-[var(--border)]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] mb-1.5">
            {"\uD83D\uDCAC"} 사용자 입력
          </div>
          <div className="text-sm">{so.user_input}</div>
        </div>
      )}

      {/* Thinking (collapsible) */}
      {so.thinking && (
        <div className="border-b border-[var(--border)]">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-5 py-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] hover:bg-[var(--accent-light)] transition-colors"
          >
            <span
              className="transition-transform"
              style={{
                display: "inline-block",
                transform: showThinking ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              {"\u25B6"}
            </span>
            {"\uD83D\uDCA1"} 사고 과정
          </button>
          {showThinking && (
            <div
              className={`px-5 pb-4 italic text-[var(--muted)] ${proseClass}`}
            >
              <Markdown remarkPlugins={[remarkGfm]}>
                {preprocessOutput(so.thinking)}
              </Markdown>
            </div>
          )}
        </div>
      )}

      {/* Assistant Output (main) */}
      <div className="px-5 py-4">
        {(so.user_input || so.thinking) && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] mb-2">
            결과
          </div>
        )}
        <div className={`${proseClass} max-h-[32rem] overflow-y-auto`}>
          <Markdown remarkPlugins={[remarkGfm]}>
            {preprocessOutput(so.assistant_output)}
          </Markdown>
        </div>
      </div>
    </div>
  );
}

/** output 텍스트 전처리: 이스케이프된 \n을 실제 줄바꿈으로 변환 + 파일경로 하이라이트 */
function preprocessOutput(text: string): string {
  // MCP에서 JSON escape된 \\n이 리터럴로 저장된 경우 실제 줄바꿈으로 복원
  let processed = text.replace(/\\n/g, "\n");
  // 파일 경로를 볼드+이모지로 하이라이트
  processed = processed.replace(
    /(?<=^|\s|`)([\w./-]+\/[\w./-]+\.\w{1,5})(?=\s|$|`|[),;:])/gm,
    "**`$1`**",
  );
  return processed;
}

/** #1: loop 로그 접기를 지원하는 타임라인 컴포넌트 */
function LoopCollapseTimeline({
  task,
  fetchTask,
}: {
  task: TaskDetail;
  fetchTask: () => void;
}) {
  // step_order별 펼침 상태 관리
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // step_order별 로그 그룹핑
  const stepCounts: Record<number, number> = {};
  const stepIndex: Record<string, number> = {};
  task.logs.forEach((log) => {
    stepCounts[log.step_order] = (stepCounts[log.step_order] || 0) + 1;
  });

  // 각 step_order에서 마지막 반복의 인덱스를 계산
  const lastIdxForStep: Record<number, number> = {};
  task.logs.forEach((log, i) => {
    lastIdxForStep[log.step_order] = i;
  });

  return (
    <div className="space-y-0">
      {task.logs.map((log, i) => {
        const isLast = i === task.logs.length - 1;
        const isPending = log.status === "pending";

        const count = stepCounts[log.step_order] || 1;
        const idx = (stepIndex[`${log.step_order}`] =
          (stepIndex[`${log.step_order}`] || 0) + 1);
        const label =
          count > 1
            ? `Step ${log.step_order} (${idx}/${count})`
            : `Step ${log.step_order}`;

        const isLoop = count > 1;
        const isLastIteration = i === lastIdxForStep[log.step_order];
        const isCollapsed =
          isLoop && !isLastIteration && !expanded[log.step_order];

        // 접기 토글 버튼: 마지막 반복 직전에 표시
        const prevLog = i > 0 ? task.logs[i - 1] : null;
        const showCollapseToggle =
          isLoop &&
          isLastIteration &&
          prevLog &&
          prevLog.step_order === log.step_order;

        return (
          <div key={log.id}>
            {/* 접기 토글 버튼 */}
            {showCollapseToggle && (
              <div className="flex gap-4 mb-1">
                <div className="w-8" />
                <button
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [log.step_order]: !prev[log.step_order],
                    }))
                  }
                  className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-dark)]"
                >
                  {expanded[log.step_order]
                    ? "접기"
                    : `이전 반복 ${count - 1}개 보기`}
                </button>
              </div>
            )}

            {/* 접혀있으면 숨김 */}
            {isCollapsed ? null : (
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      log.status === "completed"
                        ? "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]"
                        : log.status === "failed"
                          ? "border-[color:var(--destructive)] bg-[var(--destructive-light)] text-[var(--destructive-dark)]"
                          : log.status === "running"
                            ? "border-[color:var(--accent)] bg-[var(--card)] text-[var(--accent-dark)]"
                            : "border-[var(--border)] bg-transparent text-[var(--muted)]"
                    }`}
                  >
                    <StatusIcon status={log.status} />
                  </div>
                  {!isLast && (
                    <div className="min-h-4 w-0.5 flex-1 bg-[var(--border)]" />
                  )}
                </div>

                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{label}</span>
                    <Badge className={getStatusBadgeClass(log.status)}>
                      {log.status}
                    </Badge>
                    {log.node_title && (
                      <span className="text-xs text-[var(--muted)]">
                        {log.node_title}
                      </span>
                    )}
                    {log.node_type && (
                      <NodeTypeBadge nodeType={log.node_type} />
                    )}
                  </div>
                  {/* 스텝 메타: 모델, 사용자, 실행시간, credential */}
                  {(log.model_id ||
                    log.user_name ||
                    log.completed_at ||
                    log.credential_service) && (
                    <div className="flex items-center gap-3 mb-2 text-[10px] text-[var(--muted)]">
                      {log.user_name && <span>{log.user_name}</span>}
                      {log.model_id && (
                        <span className="font-mono bg-[var(--warm-light)] px-1.5 py-0.5 rounded">
                          {log.model_id}
                        </span>
                      )}
                      {log.agent_id && log.agent_id !== log.model_id && (
                        <span className="font-mono">{log.agent_id}</span>
                      )}
                      {log.credential_service && (
                        <span className="font-mono bg-[var(--warm-light)] px-1.5 py-0.5 rounded text-[10px]">
                          {"\uD83D\uDD11"}
                          {log.credential_service}
                        </span>
                      )}
                      {log.completed_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatStepDuration(log.started_at, log.completed_at)}
                        </span>
                      )}
                    </div>
                  )}

                  {log.structured_output ? (
                    <StructuredOutputView so={log.structured_output} />
                  ) : log.output ? (
                    <div className="text-sm text-[var(--foreground)] bg-[var(--card)] rounded-[var(--radius)] p-5 border border-[var(--border)] max-h-[32rem] overflow-y-auto prose prose-sm dark:prose-invert prose-headings:text-base prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-3 prose-pre:bg-gray-800 prose-pre:text-gray-200 prose-strong:text-[var(--foreground)] max-w-none">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {preprocessOutput(log.output)}
                      </Markdown>
                    </div>
                  ) : null}

                  {/* 비주얼 HTML */}
                  {log.visual_html && <VisualViewer html={log.visual_html} />}

                  {/* #2: 웹 응답 폼 (pending + 완료가 아닌 태스크) */}
                  {isPending && task.status !== "completed" && (
                    <WebResponseForm
                      taskId={task.id}
                      nodeId={log.node_id}
                      existingResponse={log.web_response}
                      onSubmit={fetchTask}
                    />
                  )}

                  {/* 이미 응답된 web_response 표시 (completed 상태) */}
                  {!isPending && log.web_response && (
                    <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--muted)]">
                      웹 응답: {log.web_response}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTask = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (res.ok) {
      const json = await res.json();
      setTask(json.data);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  useWs((msg) => {
    if (msg.type === "task_update" && msg.task_id === Number(taskId)) {
      fetchTask();
    }
  });

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-[var(--muted)]">로딩 중...</p>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-[var(--muted)]">
          태스크를 찾을 수 없습니다.
        </p>
        <Link
          href="/tasks"
          className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          &larr; 목록으로
        </Link>
      </main>
    );
  }

  const uniqueCompleted = new Set(
    task.logs.filter((l) => l.status === "completed").map((l) => l.step_order),
  ).size;
  const totalSteps = Math.max(...task.logs.map((l) => l.step_order), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* 헤더 */}
      <div className="mb-4">
        <Link
          href="/tasks"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          &larr; 목록
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Task #{task.id}</h1>
          <Badge className={getStatusBadgeClass(task.status)}>
            <StatusIcon status={task.status} />
            {task.status}
          </Badge>
        </div>
      </div>

      {/* 메타 정보 */}
      {(() => {
        const meta = parseSessionMeta(task.session_meta);
        return (
          <Card className="mb-6">
            <CardContent className="px-6 py-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">워크플로</p>
                  <p className="mt-1 text-sm font-medium">
                    {task.chain_title ?? `Chain #${task.chain_id}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">진행</p>
                  <p className="mt-1 text-sm font-medium">
                    {uniqueCompleted} / {totalSteps} steps
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">시작</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDateTime(task.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">소요 시간</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatElapsed(task.created_at, task.updated_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">사용자</p>
                  <p className="mt-1 text-sm font-medium">
                    {meta.user_name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">에이전트</p>
                  <p className="mt-1 text-sm font-medium">
                    {meta.agent || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">모델</p>
                  <p className="mt-1 font-mono text-xs font-medium">
                    {meta.model_id || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">브랜치</p>
                  <p className="mt-1 font-mono text-xs font-medium">
                    {meta.git_branch || "-"}
                  </p>
                </div>
                {meta.git_remote && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-[var(--muted)]">Git</p>
                    <p className="mt-1 truncate font-mono text-xs font-medium">
                      {meta.git_remote}
                    </p>
                  </div>
                )}
                {meta.project_dir && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-[var(--muted)]">프로젝트</p>
                    <p className="mt-1 truncate font-mono text-xs font-medium">
                      {meta.project_dir}
                    </p>
                  </div>
                )}
                <div className="md:col-span-4">
                  <p className="text-xs text-[var(--muted)]">컨텍스트</p>
                  <p className="mt-1 truncate text-sm font-medium">
                    {task.context || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* 프로그레스 바 */}
      <div className="mb-6">
        <div className="h-3 overflow-hidden rounded-full bg-[var(--warm-light)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              task.status === "failed"
                ? "bg-[var(--destructive)]"
                : task.status === "pending"
                  ? "bg-[var(--muted)]"
                  : "bg-[var(--accent)]"
            }`}
            style={{
              width:
                task.logs.length > 0
                  ? `${(uniqueCompleted / totalSteps) * 100}%`
                  : "0%",
            }}
          />
        </div>
      </div>

      {/* 요약 카드 */}
      {task.summary && (
        <Card className="mb-6">
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-sm">브레인스토밍 요약</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{task.summary}</Markdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 스텝 타임라인 */}
      <h2 className="text-lg font-semibold mb-4">실행 로그</h2>

      {task.logs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          아직 실행 로그가 없습니다.
        </p>
      ) : (
        <LoopCollapseTimeline task={task} fetchTask={fetchTask} />
      )}

      {task.status === "running" && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          WebSocket 실시간 업데이트
        </p>
      )}
    </main>
  );
}
