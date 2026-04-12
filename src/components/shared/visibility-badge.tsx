"use client";

import { Lock, Users, Globe, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n/context";

export type Visibility = "personal" | "group" | "public" | "inherit";

interface Props {
  visibility: Visibility;
  iconOnly?: boolean;
}

export function VisibilityBadge({ visibility, iconOnly }: Props) {
  const { t } = useTranslation();
  const map = {
    personal: { Icon: Lock, label: t("folders.visibilityPersonal") },
    group: { Icon: Users, label: t("folders.visibilityGroup") },
    public: { Icon: Globe, label: t("folders.visibilityPublic") },
    inherit: { Icon: FolderOpen, label: t("folders.visibilityInherit") },
  } as const;
  const { Icon, label } = map[visibility];

  const tooltipMap = {
    personal: t("folders.visibilityPersonalDesc"),
    group: t("folders.visibilityGroupDesc"),
    public: t("folders.visibilityPublicDesc"),
    inherit: t("folders.visibilityInheritDesc"),
  } as const;
  const tooltipText = tooltipMap[visibility];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="neutral" className="gap-1">
            <Icon className="h-3 w-3" />
            {!iconOnly && label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
