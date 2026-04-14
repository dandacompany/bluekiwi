"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

interface Tool {
  id: string;
  label: string;
  prefix: string;
  hint: string;
}

const TOOLS: Tool[] = [
  {
    id: "claude",
    label: "Claude Code",
    prefix: "/",
    hint: "claude-code",
  },
  {
    id: "codex",
    label: "Codex CLI",
    prefix: "$",
    hint: "openai-codex",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    prefix: "/",
    hint: "google-gemini",
  },
  {
    id: "cursor",
    label: "Cursor",
    prefix: "/",
    hint: "cursor-ide",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    prefix: "/",
    hint: "windsurf-ide",
  },
  {
    id: "other",
    label: "기타",
    prefix: "/",
    hint: "other",
  },
];

function buildCommand(
  workflowId: number,
  prefix: string,
  title: string,
  context: string,
): string {
  const parts = [title.trim(), context.trim()].filter(Boolean);
  const prompt = parts.join(" — ");
  if (prompt) {
    return `${prefix}bk-start ${workflowId} :: ${prompt}`;
  }
  return `${prefix}bk-start ${workflowId}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workflowId: number;
  workflowTitle: string;
}

export function RunCommandDialog({
  open,
  onClose,
  workflowId,
  workflowTitle,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool>(TOOLS[0]);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setStep(1);
    setTitle("");
    setContext("");
    setSelectedTool(TOOLS[0]);
    setCopied(false);
    onClose();
  };

  const command = buildCommand(workflowId, selectedTool.prefix, title, context);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the text
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-brand-blue-600" />
            <span className="max-w-[280px] truncate">{workflowTitle}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-2">
              {n > 1 && <div className="h-px w-6 bg-[var(--border)]" />}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  step === n
                    ? "bg-brand-blue-600 text-white"
                    : step > n
                      ? "bg-kiwi-500 text-white"
                      : "bg-[var(--border)]/60 text-[var(--muted-foreground)]"
                }`}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              <span
                className={`text-xs ${step === n ? "font-medium" : "text-[var(--muted-foreground)]"}`}
              >
                {n === 1
                  ? t("runDialog.step1Label")
                  : t("runDialog.step2Label")}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("runDialog.step1Desc")}
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  {t("runDialog.titleLabel")}
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("runDialog.titlePlaceholder")}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  {t("runDialog.contextLabel")}
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={t("runDialog.contextPlaceholder")}
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-brand-blue-400 focus:ring-1 focus:ring-brand-blue-400/30"
                />
                <p className="mt-1 text-right text-[10px] text-[var(--muted-foreground)]">
                  {context.length}/500
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                {t("runDialog.nextBtn")} →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Tool selector */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                {t("runDialog.toolLabel")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setSelectedTool(tool);
                      setCopied(false);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedTool.id === tool.id
                        ? "border-brand-blue-400 bg-brand-blue-50 text-brand-blue-700"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-surface-soft"
                    }`}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Command box */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                {t("runDialog.commandLabel")}
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-slate-950 px-3 py-2.5">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-emerald-400">
                  {command}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  title={t("runDialog.copyBtn")}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                    copied
                      ? "bg-kiwi-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Usage hint */}
            <p className="rounded-md bg-surface-soft px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
              {t("runDialog.usageHint")}
            </p>

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setCopied(false);
                }}
              >
                ← {t("runDialog.backBtn")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleClose}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
