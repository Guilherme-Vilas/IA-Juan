"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "bronze";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  // Primário Apple: branco gelo, texto escuro, glow frio no hover
  primary: "bg-accent text-ink-inverse font-semibold hover:bg-white hover:shadow-glow-ice",
  // Bronze metal escovado — ação-chave, com varredura de brilho (.shine)
  bronze:
    "shine bg-bronze-metal text-ink-inverse font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-glow-bronze",
  secondary:
    "bg-canvas-surface-2 text-ink border border-line hover:border-accent-bronze/35 hover:shadow-glow-bronze",
  ghost: "bg-transparent text-ink-muted hover:bg-canvas-surface-2 hover:text-ink",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  outline:
    "border border-line bg-transparent text-ink hover:border-accent-bronze/35 hover:bg-canvas-surface-2",
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
        // inputs/botões sóbrios: radius 8px (md); press físico (scale)
        "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium",
        "transition-all duration-200 active:scale-[0.97]",
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
