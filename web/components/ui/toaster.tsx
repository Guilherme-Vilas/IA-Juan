"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import type { ToastKind } from "@/lib/toast";

type Item = { id: number; message: string; kind: ToastKind };

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const COLORS: Record<ToastKind, string> = {
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger",
  info: "border-line-strong text-ink-soft",
};

let nextId = 1;

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { id, message, kind }]);
      const ttl = kind === "error" ? 7000 : 4000;
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ttl);
    }
    window.addEventListener("vita:toast", onToast);
    return () => window.removeEventListener("vita:toast", onToast);
  }, []);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-canvas-surface px-3 py-2.5 text-sm text-ink shadow-elevated ${COLORS[t.kind]}`}
          >
            <Icon size={15} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-[13px] leading-snug text-ink">{t.message}</span>
            <button
              aria-label="Fechar aviso"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="rounded p-0.5 text-ink-muted hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
