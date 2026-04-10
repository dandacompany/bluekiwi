"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  CheckCircle,
  ListTodo,
  Users,
  Workflow,
  ArrowRight,
  BookOpen,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { StatCard } from "@/components/dashboard/stat-card";
import { ActiveTasks } from "@/components/dashboard/active-tasks";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { useTranslation } from "@/lib/i18n/context";

interface DashboardData {
  stats: {
    workflows: number;
    activeTasks: number;
    completedTasks: number;
    teamMembers: number;
  };
  activeTasks: {
    id: number;
    workflow_title: string;
    status: string;
    current_step: number;
    total_steps: number;
    current_node_type: string;
  }[];
  recentActivity: {
    id: number;
    task_id: number;
    workflow_title: string;
    status: string;
    step_title: string;
    created_at: string;
  }[];
}

export default function Home() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/dashboard");
        if (!res.ok) {
          setData(null);
          return;
        }
        const text = await res.text();
        if (!text) {
          setData(null);
          return;
        }
        setData(JSON.parse(text));
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
            {t("common.loading")}
          </CardContent>
        </Card>
      </main>
    );
  }

  const stats = data?.stats ?? {
    workflows: 0,
    activeTasks: 0,
    completedTasks: 0,
    teamMembers: 0,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("dashboard.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {t("dashboard.subtitle")}
        </p>
      </section>

      {/* Stat Cards */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t("dashboard.workflows")}
          value={stats.workflows}
          subtitle={t("dashboard.registeredWorkflows")}
          icon={Workflow}
          href="/workflows"
        />
        <StatCard
          label={t("dashboard.activeTasks")}
          value={stats.activeTasks}
          subtitle={t("dashboard.active")}
          icon={ListTodo}
          href="/tasks"
        />
        <StatCard
          label={t("dashboard.completedTasks")}
          value={stats.completedTasks}
          subtitle={t("dashboard.completed")}
          icon={CheckCircle}
          href="/tasks"
        />
        <StatCard
          label={t("dashboard.teamMembers")}
          value={stats.teamMembers}
          subtitle={t("dashboard.registeredUsers")}
          icon={Users}
          href="/settings"
        />
      </section>

      {/* Active Tasks + Activity Feed */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ActiveTasks tasks={data?.activeTasks ?? []} />
        <ActivityFeed activities={data?.recentActivity ?? []} />
      </section>

      {/* Quick Links */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[var(--muted-foreground)]" />
          <h2 className="text-lg font-semibold">{t("dashboard.quickLinks")}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            {
              href: "/workflows",
              title: t("dashboard.workflowManagement"),
              desc: t("dashboard.workflowManagementDesc"),
              Icon: Workflow,
            },
            {
              href: "/tasks",
              title: t("dashboard.taskTitle"),
              desc: t("dashboard.taskDesc"),
              Icon: ListTodo,
            },
            {
              href: "/tutorial",
              title: t("dashboard.tutorialTitle"),
              desc: t("dashboard.tutorialDesc"),
              Icon: BookOpen,
            },
            {
              href: "/docs",
              title: t("dashboard.apiDocsTitle"),
              desc: t("dashboard.apiDocsDesc"),
              Icon: FileText,
            },
          ].map(({ href, title, desc, Icon }) => (
            <Link key={href} href={href} className="block">
              <Card className="h-full transition-shadow hover:shadow-soft">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                      {title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
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
