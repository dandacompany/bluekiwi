"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileJson2,
  Link2,
  LoaderCircle,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

type Mode = "export" | "import";

interface RequirementRow {
  node_index: number;
  step_order: number;
  node_title: string;
  service_name: string;
  keys: Array<{ name: string; required: boolean }>;
  candidates: Array<{
    id: number;
    service_name: string;
    matched_keys: string[];
    missing_keys: string[];
    exact_match: boolean;
  }>;
  suggested_credential_id: number | null;
}

interface AnalyzeResponse {
  summary: {
    title: string;
    version: string;
    node_count: number;
    credential_requirement_count: number;
  };
  requirements: RequirementRow[];
  requires_setup: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  workflowId?: number;
  workflowTitle?: string;
  folderId: number | null;
  onImported?: (workflowId: number) => void;
  /** Pre-loaded package (skips file upload step) */
  initialPackage?: { data: unknown; name: string };
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function WorkflowTransferDialog({
  open,
  onClose,
  mode,
  workflowId,
  workflowTitle,
  folderId,
  onImported,
  initialPackage,
}: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [packageData, setPackageData] = useState<unknown>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [bindings, setBindings] = useState<Record<string, number | null>>({});
  const [importTitle, setImportTitle] = useState("");

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setUploadName("");
      setPackageData(null);
      setAnalysis(null);
      setBindings({});
      setImportTitle("");
    }
  }, [open]);

  useEffect(() => {
    if (open && initialPackage && !packageData) {
      void handleAnalyze(initialPackage.data, initialPackage.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPackage]);

  const unresolvedCount = useMemo(() => {
    if (!analysis) return 0;
    return analysis.requirements.filter((requirement) => {
      const selected = bindings[String(requirement.node_index)];
      return typeof selected !== "number";
    }).length;
  }, [analysis, bindings]);

  const handleExport = async () => {
    if (typeof workflowId !== "number") {
      toast.error("내보낼 워크플로 정보를 찾지 못했습니다.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/export`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json?.error?.message ?? "워크플로를 내보내지 못했습니다",
        );
      }
      downloadJson(
        `${(workflowTitle ?? `workflow-${workflowId}`).replace(/\s+/g, "-").toLowerCase() || `workflow-${workflowId}`}.json`,
        json.data,
      );
      toast.success("워크플로 JSON을 다운로드했습니다.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "내보내기에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyze = async (raw: unknown, filename: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/workflows/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: raw }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json?.error?.message ?? "워크플로 JSON을 분석하지 못했습니다",
        );
      }

      const nextAnalysis = json.data as AnalyzeResponse;
      const suggestedBindings: Record<string, number | null> = {};
      for (const requirement of nextAnalysis.requirements) {
        suggestedBindings[String(requirement.node_index)] =
          requirement.suggested_credential_id;
      }

      setUploadName(filename);
      setPackageData(raw);
      setAnalysis(nextAnalysis);
      setBindings(suggestedBindings);
      setImportTitle(`${nextAnalysis.summary.title} (Imported)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "파일 분석에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      await handleAnalyze(parsed, file.name);
    } catch {
      toast.error("유효한 JSON 파일을 선택해 주세요.");
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!packageData) return;

    setBusy(true);
    try {
      const response = await fetch("/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package: packageData,
          title: importTitle,
          folder_id: folderId,
          credential_bindings: bindings,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json?.error?.message ?? "워크플로를 가져오지 못했습니다",
        );
      }
      if (typeof json?.data?.id !== "number") {
        throw new Error("가져온 워크플로 정보를 확인하지 못했습니다.");
      }
      toast.success(
        unresolvedCount > 0
          ? "워크플로를 가져왔습니다. 크레덴셜 설정이 더 필요합니다."
          : "워크플로를 가져왔습니다.",
      );
      onImported?.(json.data.id as number);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "가져오기에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-[44rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "export" ? (
              <Download className="h-4 w-4 text-brand-blue-600" />
            ) : (
              <Upload className="h-4 w-4 text-brand-blue-600" />
            )}
            {mode === "export"
              ? t("workflows.exportTitle")
              : t("workflows.importTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "export"
              ? t("workflows.exportDescription")
              : t("workflows.importDescription")}
          </DialogDescription>
        </DialogHeader>

        {mode === "export" ? (
          <div className="grid gap-4">
            <Card className="border-border/80 bg-surface-soft/60">
              <CardContent className="grid gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {workflowTitle ?? `Workflow #${workflowId ?? ""}`}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      지침 내용은 포함되고, 크레덴셜 값은 제외됩니다.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-[var(--muted-foreground)]">
                  <p>지침 내용은 파일에 포함됩니다.</p>
                  <p>크레덴셜 이름과 key 항목은 유지됩니다.</p>
                  <p>크레덴셜 값은 파일에 포함되지 않습니다.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium">워크플로 JSON 파일</span>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-border/80 bg-surface-soft/45 px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-[var(--muted-foreground)]">
                  <FileJson2 className="h-4 w-4" />
                  {uploadName || "workflow package JSON을 선택하세요"}
                </span>
                <span className="text-brand-blue-600">파일 선택</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </label>

            {analysis && (
              <>
                <Card className="border-border/80 bg-background/80">
                  <CardContent className="grid gap-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {analysis.summary.title}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          버전 {analysis.summary.version} · 노드{" "}
                          {analysis.summary.node_count}개
                        </p>
                      </div>
                    </div>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium">
                        가져올 워크플로 제목
                      </span>
                      <Input
                        value={importTitle}
                        onChange={(event) => setImportTitle(event.target.value)}
                        placeholder="Imported workflow title"
                      />
                    </label>
                  </CardContent>
                </Card>

                {analysis.requires_setup && (
                  <div className="rounded-2xl border border-[var(--destructive)]/30 bg-destructive/10 px-4 py-3 text-sm">
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
                      <div className="grid gap-1">
                        <p className="font-medium text-[var(--destructive)]">
                          크레덴셜 설정이 필요합니다
                        </p>
                        <p className="text-[var(--muted-foreground)]">
                          이 워크플로는{" "}
                          {analysis.summary.credential_requirement_count}
                          개의 크레덴셜 연결이 필요합니다. 연결하지 않아도
                          import는 가능하지만, 설정 전까지 실행은 차단됩니다.
                        </p>
                        <p className="text-[var(--muted-foreground)]">
                          현재 미연결 항목 {unresolvedCount}개 ·{" "}
                          <Link
                            href="/credentials"
                            className="font-medium text-[var(--destructive)] underline underline-offset-4"
                          >
                            크레덴셜 페이지 열기
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-3">
                  {analysis.requirements.map((requirement) => {
                    const selected =
                      bindings[String(requirement.node_index)] ?? "";

                    return (
                      <Card
                        key={`${requirement.node_index}-${requirement.service_name}`}
                        className="border-border/80 bg-surface-soft/35"
                      >
                        <CardContent className="grid gap-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                Step {requirement.step_order}.{" "}
                                {requirement.node_title}
                              </p>
                              <p className="mt-1 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                                <Link2 className="h-4 w-4" />
                                {requirement.service_name}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                typeof selected === "number"
                                  ? "border-kiwi-500 text-kiwi-700"
                                  : "border-[var(--destructive)] text-[var(--destructive)]"
                              }
                            >
                              {typeof selected === "number"
                                ? "Connected"
                                : "Setup required"}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {requirement.keys.map((key) => (
                              <Badge key={key.name} variant="outline">
                                {key.name}
                              </Badge>
                            ))}
                          </div>

                          <select
                            value={selected}
                            onChange={(event) =>
                              setBindings((current) => ({
                                ...current,
                                [String(requirement.node_index)]: event.target
                                  .value
                                  ? Number(event.target.value)
                                  : null,
                              }))
                            }
                            className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                          >
                            <option value="">나중에 설정하기</option>
                            {requirement.candidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.service_name}
                                {candidate.exact_match
                                  ? " · exact match"
                                  : candidate.missing_keys.length > 0
                                    ? ` · missing ${candidate.missing_keys.join(", ")}`
                                    : " · partial match"}
                              </option>
                            ))}
                          </select>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          {mode === "export" ? (
            <Button onClick={handleExport} disabled={busy}>
              {busy ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("workflows.export")}
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={busy || !analysis || !importTitle.trim()}
            >
              {busy ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t("workflows.import")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
