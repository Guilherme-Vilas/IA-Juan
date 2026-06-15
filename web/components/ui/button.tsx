"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "bronze";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  // Primário Apple: branco gelo, texto escuro
  primary: "bg-accent text-ink-inverse font-semibold hover:bg-white",
  // Bronze escovado — acento de requinte para ações-chave
  bronze: "bg-accent-bronze/90 text-ink-inverse font-semibold hover:bg-accent-bronze",
  secondary: "bg-canvas-surface-2 text-ink border border-line hover:border-line-strong",
  ghost: "bg-transparent text-ink-muted hover:bg-canvas-surface-2 hover:text-ink",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  outline: "border border-line bg-transparent text-ink hover:bg-canvas-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-sm",
  icon: "h-8 w-8 p-0",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        // inputs/botões sóbrios: radius 8px (md)
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
