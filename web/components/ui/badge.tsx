import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        // default neutro dark — sobrescreve com className quando precisa
        "bg-canvas-surface-2 text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
