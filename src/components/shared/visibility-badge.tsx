"use client";

import { Lock, Users, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n/context";

export type Visibility = "personal" | "group" | "public";

interface Props {
  visibility: Visibility;
  inherited?: boolean;
}

export function VisibilityBadge({ visibility, inherited }: Props) {
  const { t } = useTranslation();
  const map = {
    personal: { Icon: Lock, label: t("folders.visibilityPersonal") },
    group: { Icon: Users, label: t("folders.visibilityGroup") },
    public: { Icon: Globe, label: t("folders.visibilityPublic") },
  } as const;
  const { Icon, label } = map[visibility];

  const tooltipText =
    visibility === "personal"
      ? t("ownership.cantEdit")
      : visibility === "group"
        ? t("ownership.sharedWith")
        : t("folders.visibilityPublic");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="neutral" className="gap-1">
          <Icon className="h-3 w-3" />
          {label}
          {inherited && (
            <span className="text-[10px] opacity-70">
              ({t("folders.inheritedFromParent")})
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
