"use client";

import { Check, Loader2, XCircle, Rewind, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";

export interface TimelineStep {
  stepOrder: number;
  nodeId: number;
  title: string;
  nodeType: string;
  status: string;
  duration: string;
  /** Number of loop iterations for this step */
  iterations?: number;
}

interface TaskTimelineProps {
  taskTitle: string;
  taskStatus: string;
  provider?: string | null;
  model?: string | null;
  steps: TimelineStep[];
  currentStep: number;
  totalSteps: number;
  selectedStep: number;
  onSelectStep: (step: number) => void;
  onRewind?: () => void;
  onCancel?: () => void;
}

function nodeTypeLabel(nodeType: string, translate: (key: string) => string) {
  if (nodeType === "gate")
    return {
      label: translate("editor.gate"),
      cls: "bg-kiwi-100 text-kiwi-700",
    };
  if (nodeType === "loop")
    return {
      label: translate("editor.loop"),
      cls: "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
    };
  return {
    label: translate("editor.action"),
    cls: "bg-brand-blue-100 text-brand-blue-700",
  };
}

export function TaskTimeline({
  taskTitle,
  taskStatus,
  provider,
  model,
  steps,
  currentStep,
  totalSteps,
  selectedStep,
  onSelectStep,
  onRewind,
  onCancel,
}: TaskTimelineProps) {
  const { t } = useTranslation();
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPct =
    totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-[var(--border)] bg-surface-soft/60">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] px-5 py-5">
        <h2 className="truncate text-sm font-semibold" title={taskTitle}>
          {taskTitle}
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={taskStatus} />
          <span className="text-xs text-[var(--muted-foreground)]">
            {completedCount} / {totalSteps}
          </span>
        </div>
        {(provider || model) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            {provider && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {provider}
              </span>
            )}
            {model && (
              <span className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px]">
                {model}
              </span>
            )}
          </div>
        )}
        <Progress value={progressPct} className="mt-3 h-1.5" />
      </div>

      {/* Step list */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4">
          {steps.map((step, i) => {
            const isSelected = step.stepOrder === selectedStep;
            const isCompleted = step.status === "completed";
            const isCurrent =
              step.stepOrder === currentStep && taskStatus === "running";
            const isFailed = step.status === "failed";
            const isPending = !isCompleted && !isCurrent && !isFailed;
            const isLast = i === steps.length - 1;
            const nt = nodeTypeLabel(step.nodeType, t);

            return (
              <div key={step.stepOrder} className="flex gap-3">
                {/* Node + line */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => onSelectStep(step.stepOrder)}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all",
                      isCompleted && "bg-brand-blue-600 text-white",
                      isCurrent &&
                        "bg-kiwi-600 text-white ring-[3px] ring-kiwi-600/30",
                      isFailed && "bg-[var(--destructive)] text-white",
                      isPending &&
                        "bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] opacity-60",
                      isSelected && "ring-2 ring-brand-blue-700",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isFailed ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      t("tasks.stepLabel", { step: step.stepOrder })
                    )}
                  </button>
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-6",
                        isCompleted
                          ? "bg-brand-blue-600"
                          : "bg-[var(--border)]",
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <button
                  onClick={() => onSelectStep(step.stepOrder)}
                  className={cn(
                    "flex-1 rounded-2xl border px-3 py-2.5 pb-3 text-left transition-colors",
                    isSelected &&
                      "border-brand-blue-200 bg-[var(--card)] shadow-[var(--shadow-soft)]",
                    !isSelected &&
                      "border-transparent bg-transparent hover:border-border/70 hover:bg-[var(--card)]/80",
                  )}
                >
                  <p
                    className={cn(
                      "truncate text-[13px] font-medium leading-tight",
                      isPending && "opacity-60",
                    )}
                    title={
                      step.title ||
                      t("tasks.stepTitleFallback", { step: step.stepOrder })
                    }
                  >
                    {step.title ||
                      t("tasks.stepTitleFallback", { step: step.stepOrder })}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("px-1.5 py-0 text-[10px]", nt.cls)}
                    >
                      {nt.label}
                    </Badge>
                    {step.iterations && step.iterations > 1 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        x{step.iterations}
                      </span>
                    )}
                    {step.duration && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {step.duration}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      {taskStatus === "running" && (onRewind || onCancel) && (
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 flex gap-2">
          {onRewind && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onRewind}
            >
              <Rewind className="h-3.5 w-3.5" />
              {t("tasks.rewind")}
            </Button>
          )}
          {onCancel && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-[var(--destructive)]"
              onClick={onCancel}
            >
              <Ban className="h-3.5 w-3.5" />
              {t("tasks.cancelTask")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
    completed: "border-brand-blue-600/20 bg-transparent text-brand-blue-700",
    failed:
      "border-[color:var(--destructive)] bg-destructive/10 text-[var(--destructive)]",
    pending:
      "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
  };
  const { t } = useTranslation();
  const label =
    status === "completed"
      ? t("tasks.completed")
      : status === "failed"
        ? t("tasks.failed")
        : status === "running"
          ? t("tasks.running")
          : t("tasks.pending");
  return <Badge className={map[status] || map.pending}>{label}</Badge>;
}
