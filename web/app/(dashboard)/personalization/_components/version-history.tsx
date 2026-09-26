"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";

// Histórico de versões do prompt: toda edição salva o estado anterior no
// servidor. Restaurar também versiona o atual — nunca se perde nada.

type Version = { id: number; author: string; created_at: string; chars: number };

export function VersionHistory({
  tenantSlug,
  onRestored,
}: {
  tenantSlug: string;
  onRestored: (prompts: { system: string; knowledge: string; objections: string; examples: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin-proxy/tenants/${tenantSlug}/prompts/versions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { versions?: Version[] }) => setVersions(d.versions ?? []))
      .catch(() => toastError("Não consegui carregar o histórico."));
  }, [open, tenantSlug]);

  async function restore(v: Version) {
    if (!confirm(`Restaurar a versão de ${new Date(v.created_at).toLocaleString("pt-BR")}?\n\nO texto atual também fica guardado no histórico.`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin-proxy/tenants/${tenantSlug}/prompts/versions/${v.id}/restore`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        prompts?: { system: string; knowledge: string; objections: string; examples: string };
      };
      if (!res.ok || !data.prompts) throw new Error(data.error || "falha ao restaurar");
      onRestored(data.prompts);
      toastSuccess("Versão restaurada — já vale pras próximas conversas.");
      setOpen(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Não consegui restaurar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-ink-soft hover:text-ink"
      >
        <History size={14} /> Histórico
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-line bg-canvas-surface p-2 shadow-elevated">
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
            Versões anteriores (até 20)
          </div>
          {versions.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-ink-muted">
              Nenhuma versão ainda — a primeira aparece após você salvar uma edição.
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-canvas-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink">{new Date(v.created_at).toLocaleString("pt-BR")}</div>
                  <div className="text-[10px] text-ink-faint">
                    {Math.round(v.chars / 1000)}k caracteres{v.author ? ` · ${v.author}` : ""}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => restore(v)}
                  className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  <RotateCcw size={11} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
