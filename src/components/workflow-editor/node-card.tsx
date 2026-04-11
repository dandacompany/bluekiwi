"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquare, Repeat, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/context";

/* -- 타입 -- */

interface NodeDraft {
  key: string;
  title: string;
  node_type: "action" | "gate" | "loop";
  source: "inline" | "reference";
  instruction: string;
  instruction_id: number | null;
  credential_id: number | null;
  loop_back_to: number | null;
  hitl: boolean;
  visual_selection: boolean;
}

interface NodeCardProps {
  node: NodeDraft;
  index: number;
  isExpanded: boolean;
  onClick: () => void;
  onRemove: () => void;
}

/* -- 스타일 맵 -- */

const TYPE_ICON = {
  action: Zap,
  gate: MessageSquare,
  loop: Repeat,
} as const;

const TYPE_BORDER = {
  action: "border-l-[3px] border-l-brand-blue-600",
  gate: "border-l-[3px] border-l-kiwi-600",
  loop: "border-l-[3px] border-l-[var(--muted-foreground)]",
} as const;

const TYPE_BADGE: Record<string, string> = {
  action: "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
  gate: "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700",
  loop: "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
};

/* -- 컴포넌트 -- */

export default function NodeCard({
  node,
  index,
  isExpanded,
  onClick,
  onRemove,
}: NodeCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = TYPE_ICON[node.node_type];
  const preview =
    node.instruction.length > 80
      ? node.instruction.slice(0, 80) + "..."
      : node.instruction;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-lg border bg-[var(--card)] px-3 py-3 ${TYPE_BORDER[node.node_type]} ${
        isDragging ? "shadow-lg rotate-[1deg] z-10" : ""
      } ${isExpanded ? "ring-2 ring-brand-blue-600/30" : ""}`}
    >
      {/* drag handle */}
      <button
        type="button"
        className="mt-1 cursor-grab touch-none text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* body — clickable to expand */}
      <button
        type="button"
        className="flex flex-1 flex-col items-start gap-1 text-left"
        onClick={onClick}
      >
        <div className="flex w-full items-center gap-2">
          <span className="w-5 text-center font-mono text-xs text-[var(--muted-foreground)]">
            {index + 1}
          </span>
          <Badge className={TYPE_BADGE[node.node_type]}>
            <Icon className="h-3.5 w-3.5" />
            {t(`editor.${node.node_type}`)}
          </Badge>
          <span className="truncate text-sm font-medium">
            {node.title || t("editor.nodeTitle")}
          </span>

          {node.hitl && (
            <Badge
              variant="outline"
              className="ml-auto border-amber-500 text-amber-700"
            >
              HITL
            </Badge>
          )}
          {node.visual_selection && (
            <Badge variant="outline" className="border-kiwi-500 text-kiwi-700">
              Visual
            </Badge>
          )}
        </div>

        {preview && !isExpanded && (
          <p className="pl-7 text-xs text-[var(--muted-foreground)] line-clamp-1">
            {preview}
          </p>
        )}
      </button>

      {/* delete */}
      <button
        type="button"
        className="mt-1 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--destructive)] group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t("editor.deleteNode")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
