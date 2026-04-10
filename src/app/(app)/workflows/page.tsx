"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  MessageSquare,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";
import { useListFetch } from "@/lib/use-list-fetch";
import { useDeleteHandler } from "@/lib/use-delete-handler";

const PAGE_SIZE = 10;

interface WorkflowNodeItem {
  id: number;
  step_order: number;
  node_type: string;
  title: string;
  instruction_id: number | null;
  resolved_instruction: string;
}

interface WorkflowItem {
  id: number;
  title: string;
  description: string;
  nodes: WorkflowNodeItem[];
  created_at: string;
  owner_id?: number;
  visibility_override?: "personal" | null;
}

function NodeBadge({ node }: { node: WorkflowNodeItem }) {
  const nt = node.node_type as "action" | "gate" | "loop";
  const config =
    nt === "gate"
      ? {
          Icon: MessageSquare,
          className: "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700",
        }
      : nt === "loop"
        ? {
            Icon: Repeat,
            className:
              "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
          }
        : {
            Icon: Zap,
            className:
              "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
          };

  return (
    <Badge className={config.className}>
      <config.Icon className="h-3 w-3" />
      <span className="truncate text-[11px]">{node.title}</span>
    </Badge>
  );
}

function NodePipeline({ nodes }: { nodes: WorkflowNodeItem[] }) {
  const MAX_VISIBLE = 5;
  const visible = nodes.slice(0, MAX_VISIBLE);
  const remaining = nodes.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {visible.map((node, i) => (
        <div key={node.id} className="flex items-center gap-1.5">
          <NodeBadge node={node} />
          {i < visible.length - 1 && (
            <ArrowRight className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
          )}
        </div>
      ))}
      {remaining > 0 && (
        <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const {
    data: workflows,
    loading,
    refetch: fetchWorkflows,
  } = useListFetch<WorkflowItem>("/api/workflows", []);

  const { deleteTarget, setDeleteTarget, handleDelete } =
    useDeleteHandler<WorkflowItem>({
      endpoint: (target) => `/api/workflows/${target.id}`,
      onSuccess: async () => {
        toast.success(t("workflows.deleted"));
        await fetchWorkflows();
      },
      fallbackMessage: t("common.deleteFailed"),
    });

  const totalPages = Math.max(1, Math.ceil(workflows.length / PAGE_SIZE));
  const paged = workflows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDuplicate = async (wf: WorkflowItem) => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${wf.title} (${t("workflows.copy")})`,
        description: wf.description,
        nodes: wf.nodes.map((n) => ({
          title: n.title,
          node_type: n.node_type,
          instruction_id: n.instruction_id,
          instruction: n.resolved_instruction,
        })),
      }),
    });
    if (res.ok) {
      toast.success(t("workflows.duplicated"));
      fetchWorkflows();
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[var(--muted-foreground)]" />
          <h1 className="text-2xl font-bold tracking-tight">
            {t("workflows.title")}
          </h1>
        </div>
        <Button asChild size="sm">
          <Link href="/workflows/new">
            <Plus className="h-4 w-4" />
            {t("workflows.newWorkflow")}
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={t("workflows.empty")}
          description={t("workflows.emptyDesc")}
          actionLabel={t("workflows.newWorkflow")}
          actionHref="/workflows/new"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {paged.map((wf) => (
              <Card
                key={wf.id}
                className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-soft"
                onClick={() => router.push(`/workflows/${wf.id}`)}
              >
                <CardContent className="flex h-full flex-col justify-between p-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {wf.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                          {wf.description || "\u00A0"}
                        </p>
                        <div className="mt-1.5">
                          <VisibilityBadge
                            visibility={wf.visibility_override ?? "personal"}
                            inherited={wf.visibility_override === null}
                          />
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/workflows/${wf.id}/edit`)
                            }
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(wf)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            {t("common.duplicate")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[var(--destructive)]"
                            onClick={() => setDeleteTarget(wf)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Node pipeline */}
                    <div className="mt-3">
                      <NodePipeline nodes={wf.nodes} />
                    </div>
                  </div>

                  {/* Footer */}
                  <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                    {wf.nodes.length}
                    {t("workflows.nodes")} &middot;{" "}
                    {new Date(wf.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-[var(--muted-foreground)]">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <DeleteConfirmDialog
        target={deleteTarget}
        title={t("workflows.deleteConfirm")}
        description={`"${deleteTarget?.title ?? ""}"${t("workflows.deleteDesc")}`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
