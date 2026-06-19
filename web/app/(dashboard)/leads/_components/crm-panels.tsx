"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadNote, LeadTask, CustomFieldDef, TenantMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { User, DollarSign, Check, Trash2, Plus } from "lucide-react";

// Barra de CRM no drawer: responsavel + valor do negocio.
export function LeadCrmBar({
  lead,
  members,
  onChange,
}: {
  lead: Lead;
  members: TenantMember[];
  onChange: () => void;
}) {
  const [value, setValue] = useState(lead.value_cents != null ? String(lead.value_cents / 100) : "");
  const [savingVal, setSavingVal] = useState(false);

  // ressincroniza quando o drawer recarrega o lead
  useEffect(() => {
    setValue(lead.value_cents != null ? String(lead.value_cents / 100) : "");
  }, [lead.value_cents]);

  async function assign(userId: number | null) {
    await fetch(`/api/leads/${lead.wa_id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    onChange();
  }

  async function saveValue() {
    setSavingVal(true);
    try {
      const num = value.trim() === "" ? null : Number(value.replace(",", "."));
      await fetch(`/api/leads/${lead.wa_id}/value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: num }),
      });
      onChange();
    } finally {
      setSavingVal(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 border-b border-line px-6 py-2.5">
      <label className="flex items-center gap-2">
        <User size={14} className="shrink-0 text-ink-muted" />
        <select
          value={lead.assigned_user_id ?? ""}
          onChange={(e) => assign(e.target.value ? Number(e.target.value) : null)}
          className="min-w-0 flex-1 rounded-md border border-line bg-canvas-deep px-2 py-1.5 text-xs text-ink focus:border-line-strong focus:outline-none"
          title="Responsável"
        >
          <option value="">Sem responsável</option>
          {members
            .filter((m) => m.role !== "viewer")
            .map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || m.email}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <DollarSign size={14} className="shrink-0 text-ink-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={saveValue}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          inputMode="decimal"
          placeholder="valor (R$)"
          disabled={savingVal}
          className="min-w-0 flex-1 rounded-md border border-line bg-canvas-deep px-2 py-1.5 text-xs text-ink focus:border-line-strong focus:outline-none"
          title="Valor do negócio"
        />
      </label>
    </div>
  );
}

// Aba de notas internas (nao vao pro WhatsApp).
export function NotesPanel({ waId }: { waId: string }) {
  const [notes, setNotes] = useState<LeadNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/leads/${waId}/notes`, { cache: "no-store" });
      if (r.ok) setNotes((await r.json()).notes ?? []);
    } catch {
      setNotes([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waId]);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/leads/${waId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line pb-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Nota interna (só o time vê)…"
          className="w-full resize-none rounded-md border border-line bg-canvas-deep px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={add} disabled={busy || !draft.trim()}>
            {busy ? "Salvando…" : "Adicionar nota"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {notes === null ? (
          <div className="text-center text-xs text-ink-muted">Carregando…</div>
        ) : notes.length === 0 ? (
          <div className="text-center text-xs text-ink-muted">Nenhuma nota ainda.</div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border border-line bg-canvas-surface p-2.5 text-sm">
                <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                  <span>{n.author ?? "—"}</span>
                  <span className="ml-auto">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Aba de tarefas / lembretes do lead.
export function TasksPanel({ waId }: { waId: string }) {
  const [tasks, setTasks] = useState<LeadTask[] | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/leads/${waId}/tasks`, { cache: "no-store" });
      if (r.ok) setTasks((await r.json()).tasks ?? []);
    } catch {
      setTasks([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waId]);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/leads/${waId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, due_at: due ? new Date(due).toISOString() : null }),
      });
      setTitle("");
      setDue("");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function toggle(t: LeadTask) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done_at }),
    });
    load();
  }
  async function remove(t: LeadTask) {
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    load();
  }

  const overdue = (t: LeadTask) => !t.done_at && t.due_at && new Date(t.due_at).getTime() < Date.now();

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line pb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ligar, enviar proposta, agendar visita…"
          className="w-full rounded-md border border-line bg-canvas-deep px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 rounded-md border border-line bg-canvas-deep px-2 py-1.5 text-xs text-ink focus:border-line-strong focus:outline-none"
          />
          <Button size="sm" onClick={add} disabled={busy || !title.trim()}>
            <Plus size={14} /> Tarefa
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {tasks === null ? (
          <div className="text-center text-xs text-ink-muted">Carregando…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-xs text-ink-muted">Nenhuma tarefa.</div>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-line bg-canvas-surface px-2.5 py-2 text-sm"
              >
                <button
                  onClick={() => toggle(t)}
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                    t.done_at ? "border-success bg-success/20 text-success" : "border-line text-transparent"
                  }`}
                  title={t.done_at ? "Reabrir" : "Concluir"}
                >
                  <Check size={11} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${t.done_at ? "text-ink-faint line-through" : "text-ink"}`}>
                    {t.title}
                  </div>
                  {t.due_at && (
                    <div className={`text-[11px] ${overdue(t) ? "text-danger" : "text-ink-faint"}`}>
                      {new Date(t.due_at).toLocaleString("pt-BR")}
                      {t.assignee ? ` · ${t.assignee}` : ""}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(t)} className="text-ink-muted hover:text-danger" title="Remover">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Valores de campos customizados (renderizados a partir das definicoes do tenant).
export function CustomFieldsValues({
  lead,
  defs,
  onChange,
}: {
  lead: Lead;
  defs: CustomFieldDef[];
  onChange: () => void;
}) {
  const [vals, setVals] = useState<Record<string, unknown>>(lead.custom_fields ?? {});

  useEffect(() => {
    setVals(lead.custom_fields ?? {});
  }, [lead.custom_fields]);

  if (defs.length === 0) return null;

  async function save(key: string, value: unknown) {
    setVals((v) => ({ ...v, [key]: value }));
    await fetch(`/api/leads/${lead.wa_id}/custom`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { [key]: value } }),
    });
    onChange();
  }

  return (
    <div className="space-y-3 border-b border-line pb-4 pt-1">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Campos</div>
      {defs.map((d) => {
        const v = vals[d.key];
        return (
          <label key={d.key} className="block">
            <span className="mb-1 block text-xs text-ink-soft">{d.label}</span>
            {d.type === "select" ? (
              <select
                value={(v as string) ?? ""}
                onChange={(e) => save(d.key, e.target.value || null)}
                className="w-full rounded-md border border-line bg-canvas-deep px-2 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="">—</option>
                {d.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : d.type === "boolean" ? (
              <input
                type="checkbox"
                checked={!!v}
                onChange={(e) => save(d.key, e.target.checked)}
                className="h-4 w-4 rounded border-line bg-canvas-deep accent-accent-bronze"
              />
            ) : (
              <input
                type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"}
                defaultValue={(v as string | number) ?? ""}
                onBlur={(e) =>
                  save(d.key, e.target.value === "" ? null : d.type === "number" ? Number(e.target.value) : e.target.value)
                }
                className="w-full rounded-md border border-line bg-canvas-deep px-2 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
