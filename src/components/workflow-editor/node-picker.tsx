"use client";

import { useEffect, useState } from "react";
import { FileText, MessageSquare, Repeat, Zap } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/context";

/* -- 타입 -- */

interface InstructionOption {
  id: number;
  title: string;
  content: string;
}

export interface PickerResult {
  node_type: "action" | "gate" | "loop";
  instruction_id?: number;
  title?: string;
  instruction?: string;
}

interface NodePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: PickerResult) => void;
}

/* -- 기본 노드 타입 -- */

const BASE_TYPES = [
  {
    value: "action" as const,
    labelKey: "editor.action",
    descKey: "editor.actionDesc",
    Icon: Zap,
  },
  {
    value: "gate" as const,
    labelKey: "editor.gate",
    descKey: "editor.gateDesc",
    Icon: MessageSquare,
  },
  {
    value: "loop" as const,
    labelKey: "editor.loop",
    descKey: "editor.loopDesc",
    Icon: Repeat,
  },
];

const TYPE_BADGE: Record<string, string> = {
  action: "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
  gate: "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700",
  loop: "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
};

/* -- 컴포넌트 -- */

export default function NodePicker({
  open,
  onOpenChange,
  onSelect,
}: NodePickerProps) {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState<InstructionOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadInstructions() {
      setLoading(true);
      const res = await fetch("/api/instructions");
      const json = await res.json();
      if (cancelled) return;
      setInstructions(json.data ?? []);
      setLoading(false);
    }

    void loadInstructions();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("editor.pickerTitle")}
      description={t("editor.pickerDesc")}
    >
      <CommandInput placeholder={t("editor.searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("common.noResults")}</CommandEmpty>

        {/* 기본 노드 타입 */}
        <CommandGroup heading={t("editor.nodeTypes")}>
          {BASE_TYPES.map((bt) => (
            <CommandItem
              key={bt.value}
              onSelect={() => {
                onSelect({ node_type: bt.value });
                onOpenChange(false);
              }}
            >
              <bt.Icon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{t(bt.labelKey)}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t(bt.descKey)}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* 저장된 지침 템플릿 */}
        {!loading && instructions.length > 0 && (
          <CommandGroup heading={t("editor.savedTemplates")}>
            {instructions.map((inst) => (
              <CommandItem
                key={inst.id}
                onSelect={() => {
                  onSelect({
                    node_type: "action",
                    instruction_id: inst.id,
                    title: inst.title,
                    instruction: inst.content,
                  });
                  onOpenChange(false);
                }}
              >
                <FileText className="h-4 w-4" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{inst.title}</span>
                    <Badge className={TYPE_BADGE.action} variant="outline">
                      {t("editor.action")}
                    </Badge>
                  </div>
                  <span className="truncate text-xs text-[var(--muted-foreground)]">
                    {inst.content.length > 60
                      ? inst.content.slice(0, 60) + "..."
                      : inst.content}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
