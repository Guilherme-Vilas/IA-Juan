"use client";

import { useState } from "react";
import { PIPELINE_PHASES, type PipelineStage, type LeadState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, Plus, ArrowUp, ArrowDown, Trash2, GripVertical } from "lucide-react";

type Draft = {
  id?: number;
  name: string;
  color: string;
  trigger_state: LeadState | null;
};

const PALETTE = ["#71717A", "#60A5FA", "#22D3EE", "#FBBF24", "#C9A876", "#4ADE80", "#F87171", "#A78BFA"];

export function StageEditor({
  stages,
  onClose,
  onSaved,
}: {
  stages: PipelineStage[];
  onClose: () => void;
  onSaved: (stages: PipelineStage[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(
    stages.map((s) => ({ id: s.id, name: s.name, color: s.color, trigger_state: s.trigger_state })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setDrafts((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const copy = [...d];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));

  const add = () =>
    setDrafts((d) => [
      ...d,
      { name: "Nova etapa", color: PALETTE[d.length % PALETTE.length]!, trigger_state: null },
    ]);

  // Fases ja usadas por OUTRA etapa (pra evitar mapeamento duplicado).
  const usedBy = (i: number, phase: LeadState) =>
    drafts.some((s, idx) => idx !== i && s.trigger_state === phase);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "não foi possível salvar");
      onSaved(data.stages as PipelineStage[]);
      onClose();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-canvas-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-serif text-lg text-ink">Editar pipeline</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              A coluna "puxa" o lead quando a IA atinge a fase mapeada. Sem fase = etapa manual.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-surface-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {drafts.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-canvas-deep p-2.5">
                <GripVertical size={15} className="shrink-0 text-ink-faint" />
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => update(i, { color: e.target.value })}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line bg-transparent"
                  title="Cor"
                />
                <input
                  value={s.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
                  placeholder="Nome da etapa"
                />
                <select
                  value={s.trigger_state ?? ""}
                  onChange={(e) => update(i, { trigger_state: (e.target.value || null) as LeadState | null })}
                  className="w-40 shrink-0 rounded-md border border-line bg-canvas px-2 py-1.5 text-xs text-ink-soft focus:border-line-strong focus:outline-none"
                  title="Fase da IA que alimenta esta coluna"
                >
                  <option value="">— Manual —</option>
                  {PIPELINE_PHASES.map((p) => (
                    <option key={p.state} value={p.state} disabled={usedBy(i, p.state)}>
                      {p.label}
                      {usedBy(i, p.state) ? " (em uso)" : ""}
                    </option>
                  ))}
                </select>
                <div className="flex shrink-0 items-center">
                  <button onClick={() => move(i, -1)} className="rounded p-1 text-ink-muted hover:text-ink" title="Subir">
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => move(i, 1)} className="rounded p-1 text-ink-muted hover:text-ink" title="Descer">
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="rounded p-1 text-ink-muted hover:text-danger"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={add}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus size={15} /> Adicionar etapa
          </button>

          {err && (
            <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || drafts.length === 0}>
            {busy ? "Salvando…" : "Salvar pipeline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
