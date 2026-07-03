"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop com vidro (macOS) */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-line-strong bg-canvas-surface bg-sheen shadow-elevated",
          // hairline de luz no topo do painel
          "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px",
          "before:bg-gradient-to-r before:from-transparent before:via-accent-bronze/40 before:to-transparent before:content-['']",
          className,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between border-b border-line px-6 py-4">
            <div>
              {title && <h2 className="font-serif text-lg text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-ink-muted transition-colors hover:bg-canvas-surface-2 hover:text-ink"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
