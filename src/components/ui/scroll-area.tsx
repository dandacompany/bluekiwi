import * as React from "react";

import { cn } from "@/lib/utils";

export const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-auto", className)} {...props} />
));

ScrollArea.displayName = "ScrollArea";
