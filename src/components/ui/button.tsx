import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 font-semibold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_18px_rgba(53,87,190,0.18)] hover:bg-brand-blue-700",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-danger/90",
        outline:
          "border border-border bg-background text-foreground hover:bg-brand-blue-100 hover:text-brand-blue-700",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-strong",
        ghost:
          "text-brand-blue-700 hover:bg-brand-blue-100 hover:text-brand-blue-700",
        accent:
          "bg-accent text-accent-foreground hover:bg-kiwi-700 hover:text-white",
        link: "text-brand-blue-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 rounded-full px-5 text-[0.95rem]",
        xs: "h-6 gap-1 rounded-full px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-full px-3.5 text-sm",
        lg: "h-11 rounded-full px-6 text-[0.98rem]",
        icon: "size-10 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
