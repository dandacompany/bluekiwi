"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  MessageSquare,
  Zap,
  Repeat,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StepLog {
  id: number;
  node_id: number;
  step_order: number;
  title: string;
  node_type: string;
  status: string;
  output: string;
  structured_output: {
    user_input?: string;
    thinking?: string;
    assistant_output: string;
  } | null;
  visual_html: string | null;
  web_response: string | null;
  model_id: string | null;
  user_name: string | null;
  agent_id: string | null;
  credential_service: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface StepComment {
  id: number;
  comment: string;
  author?: string;
  step_order?: number;
  created_at: string;
}

export interface StepArtifact {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
}

interface StepDetailProps {
  /** All logs for this step (multiple if loop iterations) */
  logs: StepLog[];
  taskId: number;
  taskStatus: string;
  artifacts?: StepArtifact[];
  comments?: StepComment[];
  onAddComment?: (body: string) => void;
  onRefresh?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const proseClass =
  "prose prose-sm dark:prose-invert prose-headings:text-base prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-3 prose-pre:bg-gray-800 prose-pre:text-gray-200 prose-strong:text-[var(--foreground)] max-w-none";

function preprocessOutput(text: string): string {
  let processed = text.replace(/\\n/g, "\n");
  processed = processed.replace(
    /(?<=^|\s|`)([\w./-]+\/[\w./-]+\.\w{1,5})(?=\s|$|`|[),;:])/gm,
    "**`$1`**",
  );
  return processed;
}

function formatStepDuration(start: string, end: string | null): string {
  if (!end) return "";
  const toDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(s + "Z") : d;
  };
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

function formatCommentTimestamp(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-brand-blue-700" />;
  if (status === "failed")
    return <AlertCircle className="h-4 w-4 text-[var(--destructive)]" />;
  if (status === "running")
    return <Loader2 className="h-4 w-4 animate-spin text-brand-blue-700" />;
  return <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />;
}

function NodeTypeBadge({ nodeType }: { nodeType: string }) {
  const { t } = useTranslation();
  const config =
    nodeType === "gate"
      ? {
          Icon: MessageSquare,
          cls: "bg-kiwi-100 text-kiwi-700",
          label: t("editor.gate"),
        }
      : nodeType === "loop"
        ? {
            Icon: Repeat,
            cls: "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
            label: t("editor.loop"),
          }
        : {
            Icon: Zap,
            cls: "bg-brand-blue-100 text-brand-blue-700",
            label: t("editor.action"),
          };
  return (
    <Badge className={config.cls}>
      <config.Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StructuredOutputView({
  so,
  defaultOpen,
}: {
  so: NonNullable<StepLog["structured_output"]>;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const [showThinking, setShowThinking] = useState(defaultOpen);

  return (
    <div className="text-sm text-[var(--foreground)] bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
      {so.user_input && (
        <div className="px-5 pt-4 pb-3 bg-kiwi-100 border-b border-[var(--border)]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
            {"\uD83D\uDCE5"} {t("tasks.input")}
          </div>
          <div className="text-sm">{so.user_input}</div>
        </div>
      )}

      {so.thinking && (
        <div className="border-b border-[var(--border)]">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-5 py-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] hover:bg-brand-blue-100 transition-colors"
          >
            <span
              className="transition-transform inline-block"
              style={{
                transform: showThinking ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              {"\u25B6"}
            </span>
            {"\uD83E\uDDE0"} {t("tasks.thinking")}
          </button>
          {showThinking && (
            <div
              className={`px-5 pb-4 italic text-[var(--muted-foreground)] ${proseClass}`}
            >
              <Markdown remarkPlugins={[remarkGfm]}>
                {preprocessOutput(so.thinking)}
              </Markdown>
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-4">
        {(so.user_input || so.thinking) && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
            {"\uD83D\uDCE4"} {t("tasks.output")}
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

function VisualViewer({ html }: { html: string }) {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("tasks.viewVisual")}
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--border)] p-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{t("tasks.visualViewer")}</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                {t("common.close")}
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
  const { t } = useTranslation();
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
      <div className="rounded-[var(--radius)] border border-brand-blue-600 bg-brand-blue-100 p-3">
        <p className="mb-1 text-xs font-medium text-brand-blue-700">
          {t("tasks.responseSubmitted")}
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
    <div className="rounded-[var(--radius)] border border-kiwi-600 bg-kiwi-100 p-3">
      <p className="mb-2 text-xs font-medium text-[var(--foreground)]">
        {t("tasks.awaitingResponse")}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={t("tasks.typeResponse")}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
        />
        <Button
          onClick={handleSubmit}
          disabled={sending || !input.trim()}
          size="sm"
        >
          {sending ? t("common.loading") : t("tasks.send")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function StepDetail({
  logs,
  taskId,
  taskStatus,
  artifacts,
  comments,
  onAddComment,
  onRefresh,
}: StepDetailProps) {
  const { t } = useTranslation();
  const [commentInput, setCommentInput] = useState("");

  if (logs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
        {t("tasks.selectStep")}
      </div>
    );
  }

  // Use the last log as the "primary" (latest iteration for loops)
  const primary = logs[logs.length - 1];
  const hasMultiple = logs.length > 1;

  const handleAddComment = () => {
    if (!commentInput.trim() || !onAddComment) return;
    onAddComment(commentInput.trim());
    setCommentInput("");
  };

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6 rounded-[1.75rem] border border-border/80 bg-surface-soft/60 p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold tracking-tight">
              {primary.title ||
                t("tasks.stepTitleFallback", { step: primary.step_order })}
            </h2>
            <NodeTypeBadge nodeType={primary.node_type} />
            <Badge
              className={cn(
                primary.status === "completed" &&
                  "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
                primary.status === "failed" &&
                  "border-[color:var(--destructive)] bg-destructive/10 text-[var(--destructive)]",
                primary.status === "running" &&
                  "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
                primary.status === "pending" &&
                  "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
              )}
            >
              <StatusIcon status={primary.status} />
              {primary.status === "completed"
                ? t("tasks.completed")
                : primary.status === "failed"
                  ? t("tasks.failed")
                  : primary.status === "running"
                    ? t("tasks.running")
                    : t("tasks.pending")}
            </Badge>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)] flex-wrap">
            {primary.user_name && <span>{primary.user_name}</span>}
            {primary.model_id && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {primary.model_id}
              </span>
            )}
            {primary.agent_id && primary.agent_id !== primary.model_id && (
              <span className="font-mono text-[10px]">{primary.agent_id}</span>
            )}
            {primary.credential_service && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {"\uD83D\uDD11"}
                {primary.credential_service}
              </span>
            )}
            {primary.completed_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatStepDuration(primary.started_at, primary.completed_at)}
              </span>
            )}
            {hasMultiple && (
              <span className="text-[10px]">
                ({logs.length} {t("tasks.iteration")})
              </span>
            )}
          </div>
        </div>

        {/* Loop iterations (collapsed previous, expanded latest) */}
        {hasMultiple && (
          <LoopIterations
            logs={logs}
            taskId={taskId}
            taskStatus={taskStatus}
            onRefresh={onRefresh}
          />
        )}

        {/* Single step content */}
        {!hasMultiple && (
          <StepContent
            log={primary}
            taskId={taskId}
            taskStatus={taskStatus}
            thinkingOpen={primary.status === "running"}
            onRefresh={onRefresh}
          />
        )}

        {/* Artifacts */}
        {artifacts && artifacts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">
              {t("tasks.artifacts")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {artifacts.map((a) => (
                <a
                  key={a.id}
                  href={`/api/tasks/${taskId}/artifacts/${a.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs hover:bg-brand-blue-100 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  {a.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {(comments || onAddComment) && (
          <div className="mt-6 rounded-[1.5rem] border border-border/80 bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              {t("tasks.comments")}
              {comments && comments.length > 0 && (
                <span className="text-[var(--muted-foreground)] font-normal">
                  ({comments.length})
                </span>
              )}
            </h3>

            {comments && comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-[1rem] border border-border/80 bg-surface-soft/35 p-3.5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium capitalize">
                        {c.author ?? "User"}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {formatCommentTimestamp(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{c.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {onAddComment && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  placeholder={t("tasks.addComment")}
                  className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!commentInput.trim()}
                  size="sm"
                  variant="outline"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal: step content renderer                                    */
/* ------------------------------------------------------------------ */

function StepContent({
  log,
  taskId,
  taskStatus,
  thinkingOpen,
  onRefresh,
}: {
  log: StepLog;
  taskId: number;
  taskStatus: string;
  thinkingOpen: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-4">
      {log.structured_output ? (
        <StructuredOutputView
          so={log.structured_output}
          defaultOpen={thinkingOpen}
        />
      ) : log.output ? (
        <div
          className={cn(
            "max-h-[40rem] overflow-y-auto rounded-[1.5rem] border border-border/80 bg-[var(--card)] p-5 text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)]",
            proseClass,
          )}
        >
          <Markdown remarkPlugins={[remarkGfm]}>
            {preprocessOutput(log.output)}
          </Markdown>
        </div>
      ) : null}

      {log.visual_html && <VisualViewer html={log.visual_html} />}

      {log.status === "pending" && taskStatus !== "completed" && (
        <WebResponseForm
          taskId={taskId}
          nodeId={log.node_id}
          existingResponse={log.web_response}
          onSubmit={() => onRefresh?.()}
        />
      )}

      {log.status !== "pending" && log.web_response && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--muted-foreground)]">
          Web response: {log.web_response}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal: loop iteration viewer                                    */
/* ------------------------------------------------------------------ */

function LoopIterations({
  logs,
  taskId,
  taskStatus,
  onRefresh,
}: {
  logs: StepLog[];
  taskId: number;
  taskStatus: string;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const [showPrevious, setShowPrevious] = useState(false);
  const previous = logs.slice(0, -1);
  const latest = logs[logs.length - 1];

  return (
    <div className="space-y-4">
      {/* Toggle for previous iterations */}
      {previous.length > 0 && (
        <button
          onClick={() => setShowPrevious(!showPrevious)}
          className="text-xs text-brand-blue-600 hover:text-brand-blue-700 transition-colors"
        >
          {showPrevious
            ? t("tasks.hidePreviousIterations")
            : t("tasks.showPreviousIterations").replace(
                "{n}",
                String(previous.length),
              )}
        </button>
      )}

      {showPrevious &&
        previous.map((log, i) => (
          <Card key={log.id} className="border-border/80 opacity-75">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-[var(--muted-foreground)]">
                {t("tasks.iteration")} {i + 1} / {logs.length}
                {log.completed_at && (
                  <span className="ml-2 font-normal">
                    {formatStepDuration(log.started_at, log.completed_at)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <StepContent
                log={log}
                taskId={taskId}
                taskStatus={taskStatus}
                thinkingOpen={false}
                onRefresh={onRefresh}
              />
            </CardContent>
          </Card>
        ))}

      {/* Latest (always visible) */}
      <div>
        {logs.length > 1 && (
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2 font-medium">
            {t("tasks.latest")} ({t("tasks.iteration")} {logs.length})
          </p>
        )}
        <StepContent
          log={latest}
          taskId={taskId}
          taskStatus={taskStatus}
          thinkingOpen={latest.status === "running"}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
