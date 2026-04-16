"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  ListTodo,
  KeyRound,
  FileText,
  BookOpen,
  FileCode,
  Store,
  Settings,
  Globe,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  GitBranch,
  Coffee,
  Scale,
  Tag,
  ArrowUpCircle,
} from "lucide-react";

const MARKETPLACE_URL = "https://bluekiwi.work";
const GITHUB_URL = "https://github.com/dandacompany/bluekiwi";
const LICENSE_URL =
  "https://github.com/dandacompany/bluekiwi/blob/main/LICENSE.md";
const SUPPORT_URL = "https://buymeacoffee.com/dante.labs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarItem } from "./sidebar-item";
import { useTranslation } from "@/lib/i18n/context";

interface SidebarProps {
  user: { username: string; email: string; role: string } | null;
  teamName?: string | null;
}

export function Sidebar({ user, teamName }: SidebarProps) {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("sidebar-collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setCollapsed(JSON.parse(saved));
  }, []);

  const [updateInfo, setUpdateInfo] = useState<{
    current: string;
    hasUpdate: boolean;
    latest: string | null;
    releaseUrl: string | null;
  }>({ current: "", hasUpdate: false, latest: null, releaseUrl: null });
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then((data) => {
        setUpdateInfo({
          current: data.current ?? "",
          hasUpdate: !!data.hasUpdate,
          latest: data.latest ?? null,
          releaseUrl: data.releaseUrl ?? null,
        });
      })
      .catch(() => {});
  }, []);

  const MAIN_ITEMS = useMemo(
    () => [
      { href: "/workflows", icon: Workflow, label: t("nav.workflows") },
      { href: "/tasks", icon: ListTodo, label: t("nav.tasks") },
      { href: "/credentials", icon: KeyRound, label: t("nav.credentials") },
      { href: "/instructions", icon: FileText, label: t("nav.instructions") },
    ],
    [t],
  );

  const RESOURCE_ITEMS = useMemo(
    () => [
      { href: "/tutorial", icon: BookOpen, label: t("nav.tutorial") },
      { href: "/docs", icon: FileCode, label: t("nav.apiDocs") },
      {
        href: MARKETPLACE_URL,
        icon: Store,
        label: t("nav.marketplace"),
        external: true,
      },
    ],
    [t],
  );

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(!prev));
      return !prev;
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "relative flex h-screen flex-col overflow-visible border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] transition-[width] duration-200 ease-in-out",
          collapsed ? "w-14" : "w-[220px]",
        )}
      >
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-12 right-0 z-40 flex h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-background)] text-[var(--muted-foreground)] shadow-md transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-[var(--sidebar-border)] px-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-48.png"
              alt="BlueKiwi"
              className="h-8 w-8 shrink-0 rounded-lg"
              width={32}
              height={32}
            />
            {!collapsed && (
              <div className="min-w-0">
                <span className="block truncate font-semibold tracking-tight text-[var(--sidebar-foreground)]">
                  BlueKiwi
                </span>
                {teamName ? (
                  <span className="block truncate text-[10px] font-medium text-[var(--muted-foreground)]/85">
                    {teamName}
                  </span>
                ) : null}
              </div>
            )}
          </Link>
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!collapsed && (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("nav.main")}
            </p>
          )}
          <nav className="flex flex-col gap-0.5">
            {MAIN_ITEMS.map((item) => (
              <SidebarItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </nav>

          {!collapsed && (
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("nav.resources")}
            </p>
          )}
          {collapsed && <Separator className="my-2" />}
          <nav className="flex flex-col gap-0.5">
            {RESOURCE_ITEMS.map((item) => (
              <SidebarItem
                key={item.href}
                {...item}
                collapsed={collapsed}
                external={item.external}
              />
            ))}
          </nav>
        </div>

        {/* Bottom — User menu */}
        <div className="border-t border-[var(--sidebar-border)] px-2 py-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--sidebar-accent)]/50",
                    collapsed && "justify-center",
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-accent)] text-xs font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs font-medium text-[var(--sidebar-foreground)]">
                        {user.username}
                      </p>
                      <p className="truncate text-[10px] text-[var(--muted-foreground)]">
                        {user.role}
                      </p>
                    </div>
                  )}
                  {updateInfo.hasUpdate ? (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--sidebar-background)]" />
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? "right" : "top"}
                align="start"
                className="w-52"
              >
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  {t("nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
                >
                  <Globe className="mr-2 h-3.5 w-3.5" />
                  {locale === "ko" ? "English" : "한국어"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <GitBranch className="mr-2 h-3.5 w-3.5" />
                    {t("nav.github")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={LICENSE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <Scale className="mr-2 h-3.5 w-3.5" />
                    {t("nav.license")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <Coffee className="mr-2 h-3.5 w-3.5" />
                    {t("nav.support")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVersionDialogOpen(true)}>
                  {updateInfo.hasUpdate ? (
                    <>
                      <ArrowUpCircle className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                      <span className="flex flex-1 items-center gap-1 text-[11px] font-medium">
                        <span className="text-muted-foreground line-through">
                          v{updateInfo.current}
                        </span>
                        <span className="text-emerald-500">→</span>
                        <span className="rounded-sm bg-emerald-500/15 px-1 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          v{updateInfo.latest}
                        </span>
                      </span>
                      <Badge variant="success" className="ml-2 px-2 py-0.5">
                        {t("nav.updateAvailable")}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 h-3.5 w-3.5 opacity-50" />
                      <span className="flex-1 opacity-70">
                        {t("nav.version")} v{updateInfo.current}
                      </span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("nav.versionDialogTitle")}</DialogTitle>
            <DialogDescription>
              {updateInfo.hasUpdate
                ? t("nav.versionDialogDescUpdate", {
                    current: updateInfo.current,
                    latest: updateInfo.latest ?? "",
                  })
                : t("nav.versionDialogDescCurrent", {
                    current: updateInfo.current,
                  })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {updateInfo.hasUpdate ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t("nav.updateAvailable")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  v{updateInfo.current} → v{updateInfo.latest}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {t("nav.version")} v{updateInfo.current}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="font-medium">{t("nav.updateMethodCliTitle")}</p>
                <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                  bluekiwi upgrade
                </pre>
              </div>
              <div>
                <p className="font-medium">{t("nav.updateMethodNpmTitle")}</p>
                <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                  npm install -g bluekiwi@latest
                </pre>
              </div>
              <div>
                <p className="font-medium">
                  {t("nav.updateMethodDockerTitle")}
                </p>
                <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                  docker compose pull && docker compose up -d
                </pre>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setVersionDialogOpen(false)}
            >
              {t("common.close")}
            </button>
            <a
              href={
                updateInfo.releaseUrl ??
                `${GITHUB_URL}/releases/tag/v${updateInfo.current}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("nav.viewReleaseNotes")}
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
