"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Workflow, ListTodo, Settings, Plus, LogOut } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTranslation } from "@/lib/i18n/context";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("commandPalette.search")} />
      <CommandList>
        <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>

        <CommandGroup heading={t("commandPalette.navigate")}>
          <CommandItem onSelect={() => go("/workflows")}>
            <Workflow />
            <span>{t("nav.workflows")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/tasks")}>
            <ListTodo />
            <span>{t("nav.tasks")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings />
            <span>{t("nav.settings")}</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t("commandPalette.actions")}>
          <CommandItem onSelect={() => go("/workflows/new")}>
            <Plus />
            <span>{t("commandPalette.newWorkflow")}</span>
          </CommandItem>
          <CommandItem onSelect={() => logout()}>
            <LogOut />
            <span>{t("auth.logout")}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
