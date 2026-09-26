"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import { Clock, Plus, Trash2 } from "lucide-react";

// Follow-up de conversa: os toques que a IA manda quando o lead some.
// Salva em tenant_followups; o worker lê daqui a cada disparo.

type Step = { delay_minutes: number; text: string };
type Config = { enabled: boolean; steps: Step[]; close_after_minutes: number; work_hours_only: boolean };

const MAX_STEPS = 5;

function fmtDelay(min: number): { value: number; unit: "min" | "h" | "d" } {
  if (min % 1440 === 0 && min >= 1440) return { value: min / 1440, unit: "d" };
  if (min % 60 === 0 && min >= 60) return { value: min / 60, unit: "h" };
  return { value: min, unit: "min" };
}
const toMinutes = (value: number, unit: "min" | "h" | "d") =>
  unit === "d" ? value * 1440 : unit === "h" ? value * 60 : value;

export function FollowupEditor({ tenantSlug, initial }: { tenantSlug: string; initial: Config }) {
  const [cfg, setCfg] = useState<Config>(initial);
  const [saving, setSaving] = useState(false);

  function setStep(i: number, patch: Partial<Step>) {
    setCfg((c) => ({ ...c, steps: c.steps.map((s, si) => (si === i ? { ...s, ...patch } : s)) }));
  }

  async function save() {
    if (cfg.steps.some((s) => !s.text.trim())) {
      toastError("Todo toque precisa de um texto.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/followups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "falha ao salvar");
      toastSuccess("Follow-up salvo. Vale pros próximos toques agendados.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Não consegui salvar o follow-up.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock size={14} className="text-accent-bronze-soft" /> Follow-up (lead que some)
          </h2>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-line bg-canvas-deep accent-accent-bronze"
            />
            Ativo
          </label>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Quando o lead para de responder, a IA manda estes toques na ordem. Use {"{primeiro_nome}"} pra personalizar.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        {cfg.steps.map((s, i) => {
          const d = fmtDelay(s.delay_minutes);
          return (
            <div key={i} className="rounded-lg border border-line bg-canvas-deep p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">Toque {i + 1}</span>
                <span>— espera</span>
                <input
                  type="number"
                  min={1}
                  value={d.value}
                  onChange={(e) => setStep(i, { delay_minutes: toMinutes(Math.max(1, Number(e.target.value)), d.unit) })}
                  className="w-16 rounded-md border border-line bg-canvas-surface px-2 py-1 text-xs text-ink focus:outline-none"
                  aria-label={`Espera do toque ${i + 1}`}
                />
                <select
                  value={d.unit}
                  onChange={(e) => setStep(i, { delay_minutes: toMinutes(d.value, e.target.value as "min" | "h" | "d") })}
                  className="rounded-md border border-line bg-canvas-surface px-2 py-1 text-xs text-ink focus:outline-none"
                  aria-label="Unidade de tempo"
                >
                  <option value="min">min</option>
                  <option value="h">horas</option>
                  <option value="d">dias</option>
                </select>
                <span>{i === 0 ? "depois da última fala da IA" : "depois do toque anterior"}</span>
                {cfg.steps.length > 1 && (
                  <button
                    onClick={() => setCfg((c) => ({ ...c, steps: c.steps.filter((_, si) => si !== i) }))}
                    className="ml-auto rounded p-1 text-ink-muted hover:text-danger"
                    aria-label={`Remover toque ${i + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <textarea
                value={s.text}
                onChange={(e) => setStep(i, { text: e.target.value })}
                rows={2}
                maxLength={600}
                className="w-full rounded-md border border-line bg-canvas-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
                aria-label={`Texto do toque ${i + 1}`}
              />
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
            {cfg.steps.length < MAX_STEPS && (
              <button
                onClick={() =>
                  setCfg((c) => ({
                    ...c,
                    steps: [...c.steps, { delay_minutes: 1440, text: "" }],
                  }))
                }
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:text-ink"
              >
                <Plus size={12} /> Adicionar toque
              </button>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cfg.work_hours_only}
                onChange={(e) => setCfg((c) => ({ ...c, work_hours_only: e.target.checked }))}
                className="h-4 w-4 rounded border-line bg-canvas-deep accent-accent-bronze"
              />
              Só em horário comercial
            </label>
            <label className="flex items-center gap-1.5">
              Encerrar conversa
              <input
                type="number"
                min={1}
                value={Math.round(cfg.close_after_minutes / 60)}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, close_after_minutes: Math.max(1, Number(e.target.value)) * 60 }))
                }
                className="w-14 rounded-md border border-line bg-canvas-deep px-2 py-1 text-xs text-ink focus:outline-none"
                aria-label="Horas até encerrar após o último toque"
              />
              h após o último toque
            </label>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar follow-up"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
