"use client";

import { UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  ownerUsername: string;
  isMe?: boolean;
}

export function OwnerBadge({ ownerUsername, isMe }: Props) {
  return (
    <Badge variant="outline" className="gap-1">
      <UserCircle className="h-3 w-3" />@{ownerUsername}
      {isMe && <span className="text-[10px] opacity-70">(you)</span>}
    </Badge>
  );
}
