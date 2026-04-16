"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  MessageSquare,
  Paperclip,
  Zap,
  Repeat,
  Send,
  ShieldCheck,
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
  visual_selection: boolean | null;
  web_response: string | null;
  hitl: boolean | null;
  approved_at: string | null;
  approval_requested_at: string | null;
  provider_slug: string | null;
  model_slug: string | null;
  user_name: string | null;
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

interface NodeAttachment {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface StepDetailProps {
  /** All logs for this step (multiple if loop iterations) */
  logs: StepLog[];
  taskId: number;
  workflowId: number;
  taskStatus: string;
  registry: Record<string, string>;
  artifacts?: StepArtifact[];
  comments?: StepComment[];
  onAddComment?: (body: string) => void;
  onRefresh?: () => void;
  /** Deep link: auto-open VS dialog when true */
  autoOpenVs?: boolean;
  onVsOpened?: () => void;
}

/* ------------------------------------------------------------------ */
/*  HITL Approval Banner                                               */
/* ------------------------------------------------------------------ */

function HitlApprovalBanner({
  taskId,
  onApproved,
}: {
  taskId: number;
  onApproved?: () => void;
}) {
  const { t } = useTranslation();
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await fetch(`/api/tasks/${taskId}/approve`, { method: "POST" });
      onApproved?.();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>{t("tasks.hitlPendingApproval")}</span>
      </div>
      <Button
        size="sm"
        disabled={approving}
        onClick={() => void handleApprove()}
        className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
      >
        {approving ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t("tasks.hitlApprove")}
      </Button>
    </div>
  );
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
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

function isFragment(html: string): boolean {
  const trimmed = html.trim();
  return (
    !trimmed.startsWith("<!DOCTYPE") &&
    !trimmed.startsWith("<!doctype") &&
    !trimmed.startsWith("<html")
  );
}

type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

/** Parse `<!-- @bk size=xl -->` from visual_html to determine dialog width */
function parseDialogSize(html: string): DialogSize {
  const m = html.match(/<!--\s*@bk\b[^>]*?\bsize=["']?(\w+)/i);
  const valid: DialogSize[] = ["sm", "md", "lg", "xl", "full"];
  const v = m?.[1] as DialogSize;
  return valid.includes(v) ? v : "sm";
}

const DIALOG_WIDTH: Record<DialogSize, string> = {
  sm: "", // default sm:max-w-[28rem] = 448px
  md: "sm:max-w-2xl", // 672px
  lg: "sm:max-w-4xl", // 896px
  xl: "sm:max-w-6xl", // 1152px
  full: "sm:max-w-[95vw]", // 95% viewport
};

const SCROLL_HEIGHT: Record<DialogSize, string> = {
  sm: "max-h-[70vh]",
  md: "max-h-[80vh]",
  lg: "max-h-[85vh]",
  xl: "max-h-[88vh]",
  full: "max-h-[90vh]",
};

const IFRAME_MIN_HEIGHT: Record<DialogSize, string> = {
  sm: "min-h-[400px]",
  md: "min-h-[500px]",
  lg: "min-h-[600px]",
  xl: "min-h-[700px]",
  full: "min-h-[80vh]",
};

function VisualSelector({
  html,
  taskId,
  nodeId,
  isVisualSelection,
  logStatus,
  existingResponse,
  onSelected,
  autoOpen,
  onAutoOpened,
}: {
  html: string;
  taskId: number;
  nodeId: number;
  isVisualSelection: boolean;
  logStatus: string;
  existingResponse: string | null;
  onSelected?: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(existingResponse));
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const canSelect =
    isVisualSelection &&
    (logStatus === "pending" || logStatus === "running") &&
    !submitted;

  const dialogSize = useMemo(() => parseDialogSize(html), [html]);

  // Build srcDoc: wrap fragments with VS frame, pass full HTML as-is
  const srcDoc = useMemo(() => {
    if (!isFragment(html)) return html;
    // Lazy import to avoid bundling 30KB constant when not needed
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { VS_FRAME_TEMPLATE } = require("@/lib/vs-frame");
      const theme =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
      const locale =
        typeof document !== "undefined"
          ? document.documentElement.lang || "ko"
          : "ko";
      return (VS_FRAME_TEMPLATE as string)
        .replace("{{AGENT_CONTENT}}", html)
        .replace('data-theme="light"', `data-theme="${theme}"`)
        .replace('data-lang="ko"', `data-lang="${locale}"`);
    } catch {
      return html; // fallback if vs-frame not built
    }
  }, [html]);

  // Deep link: auto-open dialog
  useEffect(() => {
    if (autoOpen && !open) {
      setOpen(true);
      onAutoOpened?.();
    }
  }, [autoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSubmitted(Boolean(existingResponse));
  }, [existingResponse]);

  useEffect(() => {
    if (!canSelect) return;

    function handleMessage(event: MessageEvent) {
      // Filter by bk_* message type only — sandbox="allow-scripts" without allow-same-origin
      // makes WindowProxy comparison unreliable across browsers.
      const msg = event.data as {
        type?: string;
        value?: string;
        data?: object;
      };

      // Accept bk_* messages only (ignore react-devtools and other extensions)
      if (!msg?.type?.startsWith?.("bk_")) return;

      // New protocol: bk_visual_submit (structured JSON)
      if (msg?.type === "bk_visual_submit") {
        setSubmitting(true);
        fetch(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: nodeId,
            response: msg.data,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("respond failed");
            setSubmitted(true);
            onSelected?.();
          })
          .catch(() => setSubmitting(false));
        return;
      }

      // Legacy protocol: bk_visual_select (single string value)
      if (msg?.type === "bk_visual_select") {
        setSubmitting(true);
        fetch(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: nodeId,
            response: { selections: [msg.value ?? ""] },
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("respond failed");
            setSubmitted(true);
            onSelected?.();
          })
          .catch(() => setSubmitting(false));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [canSelect, taskId, nodeId, onSelected]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {isVisualSelection && canSelect
            ? t("tasks.selectVisual")
            : t("tasks.viewVisual")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn("overflow-hidden p-0", DIALOG_WIDTH[dialogSize])}
      >
        <DialogHeader className="border-b border-[var(--border)] p-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>
              {isVisualSelection && canSelect
                ? t("tasks.selectVisual")
                : t("tasks.visualViewer")}
            </DialogTitle>
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
            )}
            {submitted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                {t("common.close")}
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        {canSelect && (
          <div className="border-b border-[var(--border)] bg-amber-50 px-5 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            {t("tasks.visualSelectHint")}
          </div>
        )}
        <ScrollArea className={SCROLL_HEIGHT[dialogSize]}>
          <div className="p-5">
            <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                className={cn("w-full", IFRAME_MIN_HEIGHT[dialogSize])}
                sandbox="allow-scripts"
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function parseWebResponse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function StructuredWebResponse({ value }: { value: string | null }) {
  const { t } = useTranslation();
  const parsed = parseWebResponse(value);

  if (parsed == null) return null;

  if (!isRecord(parsed)) {
    return (
      <div className="rounded-[var(--radius)] border border-brand-blue-600 bg-brand-blue-100 p-3">
        <p className="mb-1 text-xs font-medium text-brand-blue-700">
          {t("tasks.responseSubmitted")}
        </p>
        <p className="text-sm text-[var(--foreground)]">{String(parsed)}</p>
      </div>
    );
  }

  const selections = Array.isArray(parsed.selections)
    ? parsed.selections.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const ranking = Array.isArray(parsed.ranking)
    ? parsed.ranking.filter((item): item is string => typeof item === "string")
    : [];
  const values = isRecord(parsed.values) ? parsed.values : null;
  const fields = isRecord(parsed.fields) ? parsed.fields : null;
  const optionComments = isRecord(parsed.option_comments)
    ? parsed.option_comments
    : null;
  const matrix = isRecord(parsed.matrix) ? parsed.matrix : null;
  const comment =
    typeof parsed.comment === "string" && parsed.comment.trim()
      ? parsed.comment.trim()
      : null;

  return (
    <div className="rounded-[var(--radius)] border border-brand-blue-600 bg-brand-blue-100 p-3">
      <p className="mb-3 text-xs font-medium text-brand-blue-700">
        {t("tasks.responseSubmitted")}
      </p>
      <div className="space-y-3 text-sm text-[var(--foreground)]">
        {selections.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseSelections")}
            </p>
            <div className="flex flex-wrap gap-2">
              {selections.map((selection) => (
                <span
                  key={selection}
                  className="rounded-full border border-brand-blue-600/20 bg-white/80 px-2.5 py-1 text-xs font-medium"
                >
                  {selection}
                </span>
              ))}
            </div>
          </div>
        )}

        {comment && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseComment")}
            </p>
            <p className="whitespace-pre-wrap">{comment}</p>
          </div>
        )}

        {fields && Object.keys(fields).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseFields")}
            </p>
            <div className="space-y-1.5">
              {Object.entries(fields).map(([key, fieldValue]) => (
                <div
                  key={key}
                  className="rounded-[0.9rem] border border-brand-blue-600/15 bg-white/70 px-3 py-2"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-brand-blue-700">
                    {key}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">
                    {String(fieldValue)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {optionComments && Object.keys(optionComments).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseOptionComments")}
            </p>
            <div className="space-y-1.5">
              {Object.entries(optionComments).map(([key, fieldValue]) => (
                <div
                  key={key}
                  className="rounded-[0.9rem] border border-brand-blue-600/15 bg-white/70 px-3 py-2"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-brand-blue-700">
                    {key}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">
                    {String(fieldValue)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {values && Object.keys(values).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseValues")}
            </p>
            <div className="space-y-1">
              {Object.entries(values).map(([key, fieldValue]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-[var(--muted-foreground)]">{key}</span>
                  <span className="font-medium">{String(fieldValue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ranking.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseRanking")}
            </p>
            <ol className="space-y-1">
              {ranking.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[11px] font-semibold text-brand-blue-700">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {matrix && Object.keys(matrix).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-brand-blue-700">
              {t("tasks.responseMatrix")}
            </p>
            <div className="space-y-1.5">
              {Object.entries(matrix).map(([key, coords]) => {
                const point = isRecord(coords) ? coords : {};
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-brand-blue-600/15 bg-white/70 px-3 py-2"
                  >
                    <span className="font-medium">{key}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      x: {String(point.x ?? "-")}, y: {String(point.y ?? "-")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
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
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  if (existingResponse) {
    return <StructuredWebResponse value={existingResponse} />;
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
          onKeyDown={(e) =>
            e.key === "Enter" && !e.nativeEvent.isComposing && handleSubmit()
          }
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
  workflowId,
  taskStatus,
  registry,
  artifacts,
  comments,
  onAddComment,
  onRefresh,
  autoOpenVs,
  onVsOpened,
}: StepDetailProps) {
  const { t } = useTranslation();
  const [commentInput, setCommentInput] = useState("");
  const [attachments, setAttachments] = useState<NodeAttachment[]>([]);

  // Use the last log as the "primary" (latest iteration for loops)
  const primary = logs[logs.length - 1];
  const hasMultiple = logs.length > 1;

  useEffect(() => {
    if (!workflowId || !primary?.node_id) {
      setAttachments([]);
      return;
    }

    let cancelled = false;

    async function fetchAttachments() {
      try {
        const res = await fetch(
          `/api/workflows/${workflowId}/node-items/${primary.node_id}/attachments`,
        );
        if (!res.ok) throw new Error("Failed to fetch attachments");
        const json = (await res.json()) as { data?: NodeAttachment[] };
        if (!cancelled) {
          setAttachments(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        if (!cancelled) {
          setAttachments([]);
        }
      }
    }

    void fetchAttachments();
    return () => {
      cancelled = true;
    };
  }, [workflowId, primary?.node_id]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
        {t("tasks.selectStep")}
      </div>
    );
  }

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
            {primary.provider_slug && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {registry[primary.provider_slug] ?? primary.provider_slug}
              </span>
            )}
            {primary.model_slug && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {registry[primary.model_slug] ?? primary.model_slug}
              </span>
            )}
            {primary.user_name && <span>{primary.user_name}</span>}
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

        {/* HITL approval banner */}
        {primary.hitl &&
          primary.approval_requested_at &&
          !primary.approved_at && (
            <HitlApprovalBanner taskId={taskId} onApproved={onRefresh} />
          )}
        {primary.hitl && primary.approved_at && (
          <div className="mb-4 flex items-center gap-2 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{t("tasks.hitlApproved")}</span>
          </div>
        )}

        {/* Loop iterations (collapsed previous, expanded latest) */}
        {hasMultiple && (
          <LoopIterations
            logs={logs}
            taskId={taskId}
            taskStatus={taskStatus}
            onRefresh={onRefresh}
            autoOpenVs={autoOpenVs}
            onVsOpened={onVsOpened}
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
            autoOpenVs={autoOpenVs}
            onVsOpened={onVsOpened}
          />
        )}

        {attachments.length > 0 && (
          <div className="mt-6 rounded-[1.25rem] border border-border/80 bg-[var(--card)] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="h-4 w-4" />
              Attachments
            </h3>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-[0.875rem] border border-border/80 bg-surface-soft/35 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">
                    {attachment.filename}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {formatBytes(attachment.size_bytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
                        {c.author ?? t("tasks.defaultAuthor")}
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
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    handleAddComment()
                  }
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
  autoOpenVs,
  onVsOpened,
}: {
  log: StepLog;
  taskId: number;
  taskStatus: string;
  thinkingOpen: boolean;
  onRefresh?: () => void;
  autoOpenVs?: boolean;
  onVsOpened?: () => void;
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

      {log.visual_html && (
        <VisualSelector
          html={log.visual_html}
          taskId={taskId}
          nodeId={log.node_id}
          isVisualSelection={!!log.visual_selection}
          logStatus={log.status}
          existingResponse={log.web_response}
          onSelected={() => onRefresh?.()}
          autoOpen={autoOpenVs}
          onAutoOpened={onVsOpened}
        />
      )}

      {log.status === "pending" && taskStatus !== "completed" && (
        <WebResponseForm
          taskId={taskId}
          nodeId={log.node_id}
          existingResponse={log.web_response}
          onSubmit={() => onRefresh?.()}
        />
      )}

      {log.status !== "pending" && log.web_response && (
        <StructuredWebResponse value={log.web_response} />
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
  autoOpenVs,
  onVsOpened,
}: {
  logs: StepLog[];
  taskId: number;
  taskStatus: string;
  onRefresh?: () => void;
  autoOpenVs?: boolean;
  onVsOpened?: () => void;
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
                autoOpenVs={autoOpenVs}
                onVsOpened={onVsOpened}
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
          autoOpenVs={autoOpenVs}
          onVsOpened={onVsOpened}
        />
      </div>
    </div>
  );
}
