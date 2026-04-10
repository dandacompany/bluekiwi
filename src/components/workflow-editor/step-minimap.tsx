"use client";

import { Plus } from "lucide-react";
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
  auto_advance: boolean;
}

interface StepMinimapProps {
  nodes: NodeDraft[];
  onAddClick: () => void;
}

/* -- 색상 맵 -- */

const DOT_BG: Record<string, string> = {
  action: "bg-brand-blue-600 text-white",
  gate: "bg-kiwi-600 text-white",
  loop: "bg-[var(--muted-foreground)] text-white",
};

const LINE_COLOR: Record<string, string> = {
  action: "bg-brand-blue-600",
  gate: "bg-kiwi-600",
  loop: "bg-[var(--muted-foreground)]",
};

/* -- 컴포넌트 -- */

export default function StepMinimap({ nodes, onAddClick }: StepMinimapProps) {
  const { t } = useTranslation();
  const actionCount = nodes.filter((n) => n.node_type === "action").length;
  const gateCount = nodes.filter((n) => n.node_type === "gate").length;
  const loopCount = nodes.filter((n) => n.node_type === "loop").length;

  return (
    <div className="mb-6 rounded-lg border bg-[var(--card)] p-4">
      {/* 가로 미니맵 */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {nodes.map((node, i) => (
          <div key={node.key} className="flex items-center">
            {/* 연결선 (첫번째 제외) */}
            {i > 0 && (
              <div
                className={`h-0.5 w-6 shrink-0 ${LINE_COLOR[nodes[i - 1].node_type]}`}
              />
            )}
            {/* 원형 번호 */}
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT_BG[node.node_type]}`}
              title={`${i + 1}. ${node.title || node.node_type}`}
            >
              {i + 1}
            </div>
          </div>
        ))}

        {/* + 버튼 */}
        {nodes.length > 0 && (
          <div className="h-0.5 w-6 shrink-0 border-t-2 border-dashed border-[var(--muted-foreground)]" />
        )}
        <button
          type="button"
          onClick={onAddClick}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[var(--muted-foreground)] text-[var(--muted-foreground)] transition-colors hover:border-brand-blue-600 hover:text-brand-blue-600"
          aria-label={t("editor.addNode")}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 서머리 */}
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {nodes.length} steps
        {actionCount > 0 && ` · action(${actionCount})`}
        {gateCount > 0 && ` · gate(${gateCount})`}
        {loopCount > 0 && ` · loop(${loopCount})`}
      </p>
    </div>
  );
}
