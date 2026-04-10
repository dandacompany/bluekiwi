import { Zap, MessageSquare, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NodeType = "action" | "gate" | "loop";

interface NodeTypeConfig {
  icon: LucideIcon;
  label: string;
  border: string;
  badge: string;
  bg: string;
  color: string;
}

export const NODE_TYPE_CONFIG: Record<NodeType, NodeTypeConfig> = {
  action: {
    icon: Zap,
    label: "Action",
    border: "border-brand-blue-600",
    badge: "border-brand-blue-600/20 bg-brand-blue-100 text-brand-blue-700",
    bg: "bg-brand-blue-100",
    color: "text-brand-blue-700",
  },
  gate: {
    icon: MessageSquare,
    label: "Gate",
    border: "border-kiwi-600",
    badge: "border-kiwi-600/30 bg-kiwi-100 text-kiwi-700",
    bg: "bg-kiwi-100",
    color: "text-kiwi-700",
  },
  loop: {
    icon: Repeat,
    label: "Loop",
    border: "border-border",
    badge: "border-border bg-muted text-muted-foreground",
    bg: "bg-muted",
    color: "text-muted-foreground",
  },
};

export function getNodeTypeConfig(type: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[type as NodeType] ?? NODE_TYPE_CONFIG.action;
}
