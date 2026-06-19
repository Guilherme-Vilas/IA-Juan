"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadNote, TenantMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { User, DollarSign } from "lucide-react";

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
