"use client";

import { useState, useMemo } from "react";
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
  Settings,
  Globe,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("sidebar-collapsed");
    return saved !== null ? JSON.parse(saved) : false;
  });

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
          "flex h-screen flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] transition-[width] duration-200 ease-in-out",
          collapsed ? "w-14" : "w-[220px]",
        )}
      >
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
              <span className="font-semibold tracking-tight text-[var(--sidebar-foreground)]">
                BlueKiwi
              </span>
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
              <SidebarItem key={item.href} {...item} collapsed={collapsed} />
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
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--sidebar-accent)]/50",
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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? "right" : "top"}
                align="start"
                className="w-48"
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
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            onClick={toggle}
            className="mt-1 flex w-full items-center justify-center rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)]/50 hover:text-[var(--sidebar-foreground)]"
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
