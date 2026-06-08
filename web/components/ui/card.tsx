import * as React from "react";
import { cn } from "@/lib/utils";

type CardAccent = "default" | "success" | "danger" | "warning" | "info";

const accentBar: Record<CardAccent, string> = {
  default: "before:bg-brand-600",
  success: "before:bg-success",
  danger: "before:bg-danger",
  warning: "before:bg-warning",
  info: "before:bg-info",
};

export function Card({
  className,
  accent = "default",
  hoverable = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  accent?: CardAccent;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-line bg-canvas-surface text-ink shadow-card transition-all",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]",
        accentBar[accent],
        hoverable && "hover:-translate-y-px hover:border-brand-600/40",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-line px-4 py-3 text-ink", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-3 text-ink", className)} {...props} />;
}
