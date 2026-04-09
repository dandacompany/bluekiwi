import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-[var(--accent-light)] text-[var(--accent-dark)]",
  secondary:
    "border-transparent bg-[var(--warm-light)] text-[var(--foreground)]",
  outline: "bg-transparent text-[var(--foreground)] border-[var(--border)]",
  destructive:
    "border-transparent bg-[var(--destructive-light)] text-[var(--destructive-dark)]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
