"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ListTodo, Workflow } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarDetailState {
  breadcrumbs?: BreadcrumbItem[];
  actionHref?: string;
  actionLabel?: string;
}

export function TopBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [detailState, setDetailState] = useState<TopBarDetailState | null>(
    null,
  );

  const breadcrumbMap: Record<string, string> = useMemo(
    () => ({
      workflows: t("nav.workflows"),
      tasks: t("nav.tasks"),
      credentials: t("nav.credentials"),
      instructions: t("nav.instructions"),
      tutorial: t("nav.tutorial"),
      docs: t("nav.apiDocs"),
      settings: t("nav.settings"),
      new: t("nav.new"),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveDetailState() {
      const taskMatch = pathname.match(/^\/tasks\/(\d+)$/);
      if (taskMatch) {
        const taskId = taskMatch[1];
        const res = await fetch(`/api/tasks/${taskId}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const task = json.data as
          | {
              id: number;
              workflow_id: number;
              workflow_title: string | null;
              context: string;
            }
          | undefined;

        if (!task || cancelled) return;

        setDetailState({
          breadcrumbs: [
            { label: t("nav.workflows"), href: "/workflows" },
            {
              label: task.workflow_title || `Workflow #${task.workflow_id}`,
              href: `/workflows/${task.workflow_id}`,
            },
            {
              label: task.context?.trim() || `Task #${task.id}`,
            },
          ],
          actionHref: "/tasks",
          actionLabel: t("tasks.backToList"),
        });
        return;
      }

      const workflowMatch = pathname.match(/^\/workflows\/(\d+)$/);
      if (workflowMatch) {
        const workflowId = workflowMatch[1];
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const workflow = json.data as { title: string } | undefined;

        if (!workflow || cancelled) return;

        setDetailState({
          breadcrumbs: [
            { label: t("nav.workflows"), href: "/workflows" },
            { label: workflow.title },
          ],
        });
        return;
      }

      setDetailState(null);
    }

    void resolveDetailState();
    return () => {
      cancelled = true;
    };
  }, [pathname, t]);

  const staticBreadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((seg, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      return {
        label: breadcrumbMap[seg] || seg,
        href: index === segments.length - 1 ? undefined : href,
      };
    });
  }, [pathname, breadcrumbMap]);

  const breadcrumbs = detailState?.breadcrumbs ?? staticBreadcrumbs;

  // Hide TopBar on top-level pages — they already have their own in-page header
  const isTopLevelPage = pathname.split("/").filter(Boolean).length <= 1;
  if (isTopLevelPage) return null;

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4">
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]/40" />
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-[var(--foreground)]">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
        {breadcrumbs.length === 0 && (
          <span className="font-medium text-[var(--foreground)]">
            {t("dashboard.title")}
          </span>
        )}
      </nav>

      <div className="flex items-center gap-2">
        {detailState?.actionHref && detailState.actionLabel && (
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href={detailState.actionHref}>
              <ListTodo className="h-3.5 w-3.5" />
              {detailState.actionLabel}
            </Link>
          </Button>
        )}
        {pathname.startsWith("/workflows/") &&
          !detailState?.actionHref &&
          /^\/workflows\/\d+$/.test(pathname) && (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href="/workflows">
                <Workflow className="h-3.5 w-3.5" />
                {t("workflows.backToList")}
              </Link>
            </Button>
          )}
        <kbd className="hidden h-6 items-center gap-1 rounded border border-[var(--border)] bg-[var(--muted)] px-2 text-[10px] text-[var(--muted-foreground)] sm:inline-flex">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
