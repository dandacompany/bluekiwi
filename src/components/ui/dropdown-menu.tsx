"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type Align = "start" | "end";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error(
      "DropdownMenu components must be used within <DropdownMenu>.",
    );
  }
  return ctx;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [uncontrolled, setUncontrolled] = React.useState(!!defaultOpen);
  const isControlled = typeof open === "boolean";
  const current = isControlled ? open : uncontrolled;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownMenuContext.Provider
      value={{ open: current, setOpen, triggerRef }}
    >
      {children}
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function DropdownMenuTrigger({
  asChild,
  children,
}: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownMenuContext();
  const child = React.Children.only(children);
  if (!React.isValidElement(child)) return null;

  const element = child as React.ReactElement<{
    onClick?: React.MouseEventHandler;
  }>;

  const mergedRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    const childRef = (element as unknown as { ref?: React.Ref<HTMLElement> })
      .ref;
    if (typeof childRef === "function") childRef(node);
    else if (childRef && typeof childRef === "object") {
      (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
    }
  };

  const onClick = (event: React.MouseEvent) => {
    element.props.onClick?.(event);
    if (event.defaultPrevented) return;
    setOpen(!open);
  };

  if (asChild) {
    return React.cloneElement(element as React.ReactElement<any>, {
      ref: mergedRef,
      onClick,
    });
  }

  return (
    <button ref={mergedRef} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: Align;
  sideOffset?: number;
}

export function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef } = useDropdownMenuContext();
  const [mounted, setMounted] = React.useState(false);
  const [style, setStyle] = React.useState<React.CSSProperties>({});
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + sideOffset;
    const left = align === "end" ? rect.right : rect.left;
    const transform = align === "end" ? "translateX(-100%)" : undefined;
    setStyle({ position: "fixed", top, left, transform, zIndex: 50 });
  }, [open, align, sideOffset, triggerRef]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const trigger = triggerRef.current;
      if (!target) return;
      if (contentRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={contentRef}
      style={style}
      className={cn(
        "min-w-44 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--foreground)] shadow-[var(--card-shadow-hover)]",
        className,
      )}
      {...props}
    />,
    document.body,
  );
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = useDropdownMenuContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    setOpen(false);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[calc(var(--radius)-2px)] px-2 py-1.5 text-sm hover:bg-[var(--warm-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
});

DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <div className={cn("my-1 h-px w-full bg-[var(--border)]", className)} />
  );
}
