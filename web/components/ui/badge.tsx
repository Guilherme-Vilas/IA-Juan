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
        "inline-flex items-center gap-1 rounded-md border border-line bg-canvas-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Indicador de status com ponto colorido (estilo Linear/Vercel)
export function StatusDot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", className)} />;
}
