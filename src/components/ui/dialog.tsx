"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog components must be used within <Dialog>.");
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DialogProps) {
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
    <DialogContext.Provider value={{ open: current, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { setOpen } = useDialogContext();

  const child = React.Children.only(children);
  if (!React.isValidElement(child)) return null;

  const element = child as React.ReactElement<{
    onClick?: React.MouseEventHandler;
  }>;
  const onClick: React.MouseEventHandler = (event) => {
    element.props.onClick?.(event);
    if (event.defaultPrevented) return;
    setOpen(true);
  };

  if (asChild) return React.cloneElement(element, { onClick });
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export interface DialogCloseProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function DialogClose({ asChild, children }: DialogCloseProps) {
  const { setOpen } = useDialogContext();
  const child = React.Children.only(children);
  if (!React.isValidElement(child)) return null;

  const element = child as React.ReactElement<{
    onClick?: React.MouseEventHandler;
  }>;
  const onClick: React.MouseEventHandler = (event) => {
    element.props.onClick?.(event);
    if (event.defaultPrevented) return;
    setOpen(false);
  };

  if (asChild) return React.cloneElement(element, { onClick });
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  overlayClassName?: string;
}

export function DialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: DialogContentProps) {
  const { open, setOpen } = useDialogContext();
  const [mounted, setMounted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    // Focus content for keyboard users.
    queueMicrotask(() => contentRef.current?.focus());

    // Scroll lock
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, setOpen]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "fixed inset-0 bg-black/30 backdrop-blur-[2px]",
          overlayClassName,
        )}
        onMouseDown={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={cn(
            "w-full max-w-4xl rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--card-shadow-hover)] outline-none",
            className,
          )}
          onMouseDown={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 p-5 pt-0", className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-base font-semibold", className)}
    {...props}
  />
));

DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--muted)]", className)}
    {...props}
  />
));

DialogDescription.displayName = "DialogDescription";
