import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hoverable = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return (
    <div
      className={cn(
        // sheen de vidro no topo + hairline interna: profundidade sem peso
        "relative rounded-xl border border-line bg-canvas-surface bg-sheen text-ink shadow-card",
        "before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-['']",
        hoverable &&
          "transition-all duration-300 hover:-translate-y-[2px] hover:border-accent-bronze/30 hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-line px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
