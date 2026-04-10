"use client";

import { FileText, Plus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTranslation } from "@/lib/i18n/context";

interface Instruction {
  id: number;
  title: string;
  content: string;
}

interface InstructionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructions: Instruction[];
  onSelect: (instructionId: number) => void;
  onCreateNew: () => void;
}

export function InstructionPicker({
  open,
  onOpenChange,
  instructions,
  onSelect,
  onCreateNew,
}: InstructionPickerProps) {
  const { t } = useTranslation();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("editor.searchInstruction")} />
      <CommandList>
        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
        <CommandGroup heading={t("editor.savedTemplates")}>
          {instructions.map((inst) => (
            <CommandItem
              key={inst.id}
              onSelect={() => {
                onSelect(inst.id);
                onOpenChange(false);
              }}
            >
              <FileText className="mr-2 h-4 w-4 shrink-0 text-brand-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  #{inst.id} {inst.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {inst.content.slice(0, 80)}
                </p>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading={t("common.create")}>
          <CommandItem
            onSelect={() => {
              onCreateNew();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4 text-brand-blue-600" />
            <span className="text-sm font-medium">
              {t("editor.createNewInstruction")}
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
