import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

function getButtonClasses({
  variant,
  size,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    default:
      "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-dark)]",
    secondary:
      "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--warm-light)]",
    outline:
      "bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--card)]",
    ghost:
      "bg-transparent text-[var(--foreground)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-dark)]",
    destructive:
      "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive-dark)]",
    link: "bg-transparent text-[var(--accent)] underline-offset-4 hover:underline",
  };

  const sizes: Record<ButtonSize, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3",
    lg: "h-11 px-6",
    icon: "h-10 w-10 p-0",
  };

  return cn(base, variants[variant], sizes[size]);
}

function mergeHandlers<E>(
  primary?: (event: E) => void,
  secondary?: (event: E) => void,
) {
  return (event: E) => {
    primary?.(event);
    secondary?.(event);
  };
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const classes = cn(getButtonClasses({ variant, size }), className);

    if (asChild) {
      if (!React.isValidElement(children)) {
        throw new Error(
          "Button with `asChild` expects a single React element.",
        );
      }

      const child = children as React.ReactElement<{
        className?: string;
        onClick?: React.MouseEventHandler;
      }>;

      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        onClick: mergeHandlers(onClick, child.props.onClick),
      });
    }

    return (
      <button ref={ref} className={classes} onClick={onClick} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
