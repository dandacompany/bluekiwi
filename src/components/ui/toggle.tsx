"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToggleVariant = "default" | "outline";
type ToggleSize = "default" | "sm" | "lg";

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      pressed,
      defaultPressed,
      onPressedChange,
      variant = "outline",
      size = "default",
      onClick,
      ...props
    },
    ref,
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState(!!defaultPressed);
    const isControlled = typeof pressed === "boolean";
    const isPressed = isControlled ? pressed : uncontrolled;

    const variants: Record<ToggleVariant, string> = {
      default:
        "bg-[var(--accent-light)] text-[var(--accent-dark)] border border-[color:var(--accent)]",
      outline:
        "bg-transparent text-[var(--foreground)] border border-[var(--border)]",
    };

    const sizes: Record<ToggleSize, string> = {
      default: "h-9 px-3 text-sm",
      sm: "h-8 px-2.5 text-xs",
      lg: "h-10 px-4 text-sm",
    };

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      const next = !isPressed;
      if (!isControlled) setUncontrolled(next);
      onPressedChange?.(next);
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isPressed}
        data-state={isPressed ? "on" : "off"}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[var(--accent-light)] data-[state=on]:text-[var(--accent-dark)]",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Toggle.displayName = "Toggle";
