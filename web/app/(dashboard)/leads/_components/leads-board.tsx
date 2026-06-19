"use client";

import { useEffect, useState } from "react";
import type { Lead, PipelineStage } from "@/lib/types";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { StageEditor } from "./stage-editor";
import { Button } from "@/components/ui/button";
import { Settings2, Hand, Trophy, XCircle } from "lucide-react";

// Lead aparece no board se: aberto, agendado, em atendimento humano, ou com
// desfecho (Ganho/Perdido fica visivel na coluna terminal). Leads "mortos" sem
// desfecho explicito (sem interesse / sem resposta / adiado) saem do board.
function onBoard(l: Lead): boolean {
  return (
    l.status === "open" ||
    l.closed_reason === "scheduled" ||
    l.closed_reason === "handoff" ||
    l.outcome != null
  );
}

const LOST_PRESETS = ["Preço", "Timing", "Foi com concorrente", "Sem fit", "Sumiu"];

function ageInfo(lead: Lead, stage?: PipelineStage): { label: string; stale: boolean } {
  const hours = (Date.now() - new Date(lead.stage_entered_at).getTime()) / 3_600_000;
  const label = hours < 1 ? "<1h" : hours < 24 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`;
  const stale =
    !!stage?.sla_hours && hours > stage.sla_hours && !stage.is_won && !stage.is_lost && lead.status === "open";
  return { label, stale };
}

export function LeadsBoard({
  initial,
  initialStages,
}: {
  initial: Lead[];
  initialStages: PipelineStage[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initial);
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [lostPrompt, setLostPrompt] = useState<{ waId: string; stageId: number } | null>(null);
  const [lostReason, setLostReason] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (res.ok) setLeads(await res.json());
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const firstStageId = stages[0]?.id ?? null;
  const visible = leads.filter(onBoard);
  const stageOf = (l: Lead) => l.pipeline_stage_id ?? firstStageId;

  function performMove(waId: string, stageId: number, reason?: string) {
    const lead = leads.find((l) => l.wa_id === waId);
    if (!lead) return;
    const stage = stages.find((s) => s.id === stageId);
    const mapped = stage?.trigger_state ?? null;
    const outcome = stage?.is_won ? "won" : stage?.is_lost ? "lost" : null;

    setLeads((prev) =>
      prev.map((l) =>
        l.wa_id === waId
          ? {
              ...l,
              pipeline_stage_id: stageId,
              stage_manual: mapped == null,
              state: mapped ?? l.state,
              stage_entered_at: new Date().toISOString(),
              outcome,
              outcome_reason: outcome ? reason ?? "" : "",
            }
          : l,
      ),
    );
    fetch(`/api/leads/${waId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_stage_id: stageId, reason }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("move failed");
      })
      .catch(() => refresh());
  }

  function handleDrop(stageId: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const waId = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => l.wa_id === waId);
    if (!lead || stageOf(lead) === stageId) return;
    const stage = stages.find((s) => s.id === stageId);
    // Coluna "Perdido": pede o motivo antes de mover.
    if (stage?.is_lost) {
      setLostReason("");
      setLostPrompt({ waId, stageId });
      return;
    }
    performMove(waId, stageId);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-xs text-ink-muted">
          {visible.length} no funil · arraste pra mover · a IA move sozinha conforme qualifica
        </span>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-canvas-surface-2 hover:text-ink"
        >
          <Settings2 size={14} /> Editar etapas
        </button>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4">
        {stages.map((stage) => {
          const col = visible.filter((l) => stageOf(l) === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
              onDrop={(e) => handleDrop(stage.id, e)}
              className={`flex h-full w-72 shrink-0 flex-col rounded-lg bg-canvas-surface shadow-card transition-colors ${
                dragOver === stage.id ? "ring-2 ring-accent-bronze/60" : ""
              }`}
            >
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink">{stage.name}</span>
                  {stage.is_won && <Trophy size={11} className="text-success" />}
                  {stage.is_lost && <XCircle size={11} className="text-danger" />}
                  {stage.trigger_state == null && !stage.is_won && !stage.is_lost && (
                    <span title="Etapa manual — a IA não move pra cá" className="text-ink-faint">
                      <Hand size={11} />
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-muted">{col.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {col.length === 0 ? (
                  <div className="grid h-24 place-items-center text-xs text-ink-faint">vazio</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {col.map((l) => {
                      const { label, stale } = ageInfo(l, stage);
                      return (
                        <div
                          key={l.wa_id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", l.wa_id)}
                          className={`cursor-grab active:cursor-grabbing ${
                            l.stage_manual ? "rounded-md ring-1 ring-accent-bronze/40" : ""
                          }`}
                        >
                          <LeadCard lead={l} onClick={() => setSelected(l.wa_id)} ageLabel={label} stale={stale} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LeadDrawer waId={selected} onClose={() => setSelected(null)} onChange={refresh} />

      {editing && (
        <StageEditor
          stages={stages}
          onClose={() => setEditing(false)}
          onSaved={(s) => {
            setStages(s);
            refresh();
          }}
        />
      )}

      {lostPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setLostPrompt(null)}>
          <div
            className="w-full max-w-sm rounded-xl border border-line bg-canvas-surface p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg text-ink">Motivo da perda</h3>
            <p className="mt-1 text-xs text-ink-muted">Ajuda a entender por que leads não fecham.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {LOST_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setLostReason(p)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                    lostReason === p
                      ? "border-line-strong bg-canvas-surface-2 text-ink"
                      : "border-line text-ink-muted hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={2}
              placeholder="motivo (opcional)"
              className="mt-3 w-full resize-none rounded-md border border-line bg-canvas-deep px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setLostPrompt(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  performMove(lostPrompt.waId, lostPrompt.stageId, lostReason.trim() || undefined);
                  setLostPrompt(null);
                }}
              >
                Marcar como perdido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
