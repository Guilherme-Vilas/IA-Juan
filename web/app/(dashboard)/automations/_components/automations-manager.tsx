"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Automation,
  AutomationActionType,
  AutomationTrigger,
  AutomationFull,
  PipelineStage,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Zap, Power } from "lucide-react";

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  lead_created: "Lead novo",
  stage_entered: "Entrou numa etapa",
  lead_won: "Negócio ganho",
  lead_lost: "Negócio perdido",
  no_reply: "Sem resposta",
};
const ACTION_LABELS: Record<AutomationActionType, string> = {
  send_message: "Enviar mensagem",
  create_task: "Criar tarefa",
  add_note: "Adicionar nota",
  assign_round_robin: "Atribuir (round-robin)",
  move_stage: "Mover de etapa",
  notify_owner: "Avisar o dono",
};

const inputCls =
  "w-full rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-medium text-ink-soft";

type Unit = "min" | "h" | "d";
type StepDraft = { delay: number; unit: Unit; action_type: AutomationActionType; cfg: Record<string, unknown> };
type Draft = {
  id?: number;
  name: string;
  enabled: boolean;
  trigger_type: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  stop_on_reply: boolean;
  steps: StepDraft[];
};

function minutesToUnit(m: number): { delay: number; unit: Unit } {
  if (m && m % 1440 === 0) return { delay: m / 1440, unit: "d" };
  if (m && m % 60 === 0) return { delay: m / 60, unit: "h" };
  return { delay: m, unit: "min" };
}
const unitToMinutes = (delay: number, unit: Unit) => (unit === "d" ? delay * 1440 : unit === "h" ? delay * 60 : delay);

function emptyDraft(): Draft {
  return {
    name: "",
    enabled: true,
    trigger_type: "no_reply",
    trigger_config: { hours: 24 },
    conditions: {},
    stop_on_reply: true,
    steps: [{ delay: 0, unit: "min", action_type: "send_message", cfg: { text: "" } }],
  };
}

export function AutomationsManager({
  initial,
  stages,
  error,
}: {
  initial: Automation[];
  stages: PipelineStage[];
  error: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function openEdit(a: Automation) {
    setLoadingId(a.id);
    try {
      const res = await fetch(`/api/automations/${a.id}`, { cache: "no-store" });
      const data = (await res.json()) as { automation: AutomationFull };
      const f = data.automation;
      setEditing({
        id: f.id,
        name: f.name,
        enabled: f.enabled,
        trigger_type: f.trigger_type,
        trigger_config: f.trigger_config ?? {},
        conditions: f.conditions ?? {},
        stop_on_reply: f.stop_on_reply,
        steps: (f.steps ?? []).map((s) => ({
          ...minutesToUnit(s.delay_minutes),
          action_type: s.action_type,
          cfg: s.action_config ?? {},
        })),
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function toggle(a: Automation) {
    await fetch(`/api/automations/${a.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    router.refresh();
  }
  async function remove(a: Automation) {
    if (!confirm(`Excluir a automação "${a.name}"?`)) return;
    await fetch(`/api/automations/${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">{initial.length} automações</span>
        <Button size="sm" onClick={() => setEditing(emptyDraft())}>
          <Plus size={14} /> Nova automação
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <div className="space-y-2">
        {initial.length === 0 && (
          <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-muted">
            <Zap size={20} className="mx-auto mb-2 text-ink-faint" />
            Nenhuma automação ainda. Crie uma cadência de follow-up, por exemplo.
          </div>
        )}
        {initial.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-canvas-surface p-3">
            <button
              onClick={() => toggle(a)}
              title={a.enabled ? "Ativa — clique p/ pausar" : "Pausada — clique p/ ativar"}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                a.enabled ? "border-success/40 bg-success/10 text-success" : "border-line text-ink-faint"
              }`}
            >
              <Power size={15} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{a.name}</div>
              <div className="text-xs text-ink-faint">
                {TRIGGER_LABELS[a.trigger_type]} · {a.steps} {a.steps === 1 ? "passo" : "passos"}
                {a.stop_on_reply ? " · para se responder" : ""}
              </div>
            </div>
            <button
              onClick={() => openEdit(a)}
              disabled={loadingId === a.id}
              className="p-1.5 text-ink-muted hover:text-ink"
            >
              <Pencil size={15} />
            </button>
            <button onClick={() => remove(a)} className="p-1.5 text-ink-muted hover:text-danger">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <Builder draft={editing} stages={stages} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
      )}
    </div>
  );
}

function Builder({
  draft,
  stages,
  onClose,
  onSaved,
}: {
  draft: Draft;
  stages: PipelineStage[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((c) => ({ ...c, ...patch }));
  const setCond = (patch: Record<string, unknown>) => set({ conditions: { ...d.conditions, ...patch } });

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    set({ steps: d.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const setStepCfg = (i: number, patch: Record<string, unknown>) =>
    setStep(i, { cfg: { ...d.steps[i]!.cfg, ...patch } });
  const addStep = () =>
    set({ steps: [...d.steps, { delay: 1, unit: "d", action_type: "send_message", cfg: { text: "" } }] });
  const removeStep = (i: number) => set({ steps: d.steps.filter((_, idx) => idx !== i) });

  async function save() {
    setBusy(true);
    setErr(null);
    const body = {
      name: d.name.trim(),
      enabled: d.enabled,
      trigger_type: d.trigger_type,
      trigger_config: d.trigger_config,
      conditions: Object.fromEntries(Object.entries(d.conditions).filter(([, v]) => v !== "" && v != null)),
      stop_on_reply: d.stop_on_reply,
      steps: d.steps.map((s) => ({
        delay_minutes: unitToMinutes(Number(s.delay) || 0, s.unit),
        action_type: s.action_type,
        action_config: s.cfg,
      })),
    };
    try {
      const res = d.id
        ? await fetch(`/api/automations/${d.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/automations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha ao salvar");
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-canvas-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-ink">{d.id ? "Editar automação" : "Nova automação"}</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <label className="block">
            <span className={labelCls}>Nome</span>
            <input
              value={d.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ex: Cadência de follow-up"
              className={inputCls}
            />
          </label>

          {/* Gatilho */}
          <div className="rounded-lg border border-line bg-canvas-deep p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Quando</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <select
                value={d.trigger_type}
                onChange={(e) => set({ trigger_type: e.target.value as AutomationTrigger, trigger_config: {} })}
                className={inputCls}
              >
                {(Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
              {d.trigger_type === "no_reply" && (
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  há
                  <input
                    type="number"
                    min={1}
                    value={(d.trigger_config.hours as number) ?? 24}
                    onChange={(e) => set({ trigger_config: { hours: Number(e.target.value) } })}
                    className={inputCls}
                  />
                  horas
                </label>
              )}
              {d.trigger_type === "stage_entered" && (
                <select
                  value={(d.trigger_config.stage_id as number) ?? ""}
                  onChange={(e) => set({ trigger_config: { stage_id: Number(e.target.value) } })}
                  className={inputCls}
                >
                  <option value="">— escolha a etapa —</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={d.stop_on_reply}
                onChange={(e) => set({ stop_on_reply: e.target.checked })}
                className="h-4 w-4 rounded border-line bg-canvas-deep accent-accent-bronze"
              />
              Parar a cadência se o lead responder
            </label>
          </div>

          {/* Condicoes opcionais */}
          <details className="rounded-lg border border-line bg-canvas-deep p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Condições (opcional)
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <label className="block">
                <span className={labelCls}>Está na etapa</span>
                <select
                  value={(d.conditions.stage_id as number) ?? ""}
                  onChange={(e) => setCond({ stage_id: e.target.value ? Number(e.target.value) : "" })}
                  className={inputCls}
                >
                  <option value="">qualquer</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Score mínimo</span>
                <input
                  type="number"
                  value={(d.conditions.min_score as number) ?? ""}
                  onChange={(e) => setCond({ min_score: e.target.value ? Number(e.target.value) : "" })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Origem contém</span>
                <input
                  value={(d.conditions.source_contains as string) ?? ""}
                  onChange={(e) => setCond({ source_contains: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
          </details>

          {/* Passos */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Faça</div>
            <div className="space-y-2">
              {d.steps.map((s, i) => (
                <div key={i} className="rounded-lg border border-line bg-canvas-deep p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-muted">esperar</span>
                    <input
                      type="number"
                      min={0}
                      value={s.delay}
                      onChange={(e) => setStep(i, { delay: Number(e.target.value) })}
                      className="w-16 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-line-strong focus:outline-none"
                    />
                    <select
                      value={s.unit}
                      onChange={(e) => setStep(i, { unit: e.target.value as Unit })}
                      className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink-soft focus:border-line-strong focus:outline-none"
                    >
                      <option value="min">min</option>
                      <option value="h">horas</option>
                      <option value="d">dias</option>
                    </select>
                    <span className="text-[11px] text-ink-muted">e</span>
                    <select
                      value={s.action_type}
                      onChange={(e) => setStep(i, { action_type: e.target.value as AutomationActionType, cfg: {} })}
                      className="flex-1 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-line-strong focus:outline-none"
                    >
                      {(Object.keys(ACTION_LABELS) as AutomationActionType[]).map((t) => (
                        <option key={t} value={t}>
                          {ACTION_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removeStep(i)} className="p-1 text-ink-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <ActionConfig step={s} stages={stages} onChange={(patch) => setStepCfg(i, patch)} />
                </div>
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink"
            >
              <Plus size={14} /> Adicionar passo
            </button>
          </div>

          {err && <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || !d.name.trim() || d.steps.length === 0}>
            {busy ? "Salvando…" : "Salvar automação"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionConfig({
  step,
  stages,
  onChange,
}: {
  step: StepDraft;
  stages: PipelineStage[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const c = step.cfg;
  if (step.action_type === "send_message" || step.action_type === "notify_owner") {
    return (
      <textarea
        value={(c.text as string) ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={2}
        placeholder={
          step.action_type === "send_message"
            ? "Mensagem pro lead. Use {nome} ou {primeiro_nome}."
            : "Aviso pro dono no WhatsApp."
        }
        className="mt-2 w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
      />
    );
  }
  if (step.action_type === "create_task") {
    return (
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input
          value={(c.title as string) ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título da tarefa"
          className="col-span-2 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <input
          type="number"
          value={(c.due_in_hours as number) ?? ""}
          onChange={(e) => onChange({ due_in_hours: e.target.value ? Number(e.target.value) : null })}
          placeholder="vence em (h)"
          className="rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
      </div>
    );
  }
  if (step.action_type === "add_note") {
    return (
      <textarea
        value={(c.body as string) ?? ""}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={2}
        placeholder="Nota interna"
        className="mt-2 w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
      />
    );
  }
  if (step.action_type === "move_stage") {
    return (
      <select
        value={(c.stage_id as number) ?? ""}
        onChange={(e) => onChange({ stage_id: Number(e.target.value) })}
        className="mt-2 w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        <option value="">— etapa de destino —</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  }
  return null; // assign_round_robin: sem config
}
