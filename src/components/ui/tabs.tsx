"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string | undefined;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>.");
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const isControlled = typeof value === "string";
  const current = isControlled ? value : uncontrolled;

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-[var(--warm-light)] p-1 text-[var(--muted)]",
      className,
    )}
    {...props}
  />
));

TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, value, onClick, ...props }, ref) => {
  const { value: active, setValue } = useTabsContext();
  const state = active === value ? "active" : "inactive";

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    setValue(value);
  };

  return (
    <button
      ref={ref}
      type="button"
      data-state={state}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--card)] data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-[var(--card-shadow)]",
        className,
      )}
      {...props}
    />
  );
});

TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: active } = useTabsContext();
    if (active !== value) return null;

    return (
      <div
        ref={ref}
        className={cn("mt-4 focus-visible:outline-none", className)}
        {...props}
      />
    );
  },
);

TabsContent.displayName = "TabsContent";
