"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldOff, Trash2, Plus } from "lucide-react";

type BlacklistRow = {
  id: number;
  external_id: string;
  reason: "opt_out" | "manual" | "bounced";
  source: string | null;
  created_at: string;
};

const REASON_LABEL: Record<BlacklistRow["reason"], string> = {
  opt_out: "pediu pra sair",
  manual: "bloqueio manual",
  bounced: "número inválido",
};

// Gestão da lista de bloqueio (LGPD): quem está aqui NUNCA recebe prospecção.
export function BlacklistButton({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-4 text-[13px] text-ink-soft transition-colors hover:border-accent-bronze/40 hover:text-ink"
        title="Números que nunca recebem prospecção"
      >
        <ShieldOff size={14} /> Blacklist
      </button>
      {open && <BlacklistModal tenantSlug={tenantSlug} onClose={() => setOpen(false)} />}
    </>
  );
}

function BlacklistModal({ tenantSlug, onClose }: { tenantSlug: string; onClose: () => void }) {
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const base = `/api/admin-proxy/tenants/${tenantSlug}/blacklist`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.ok) setRows((await res.json()).blacklist ?? []);
    } finally {
      setLoaded(true);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id: phone, reason: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao bloquear");
      setPhone("");
      await load();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (externalId: string) => {
    await fetch(`${base}/${encodeURIComponent(externalId)}`, { method: "DELETE" }).catch(() => undefined);
    await load();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Blacklist de prospecção"
      subtitle="Números aqui NUNCA recebem abordagem — opt-outs entram sozinhos (LGPD)"
      className="max-w-xl"
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="telefone com DDD (ex: 41 99999-8888)"
            inputMode="tel"
          />
          <Button variant="bronze" onClick={add} disabled={busy || !phone.trim()}>
            <Plus size={13} /> Bloquear
          </Button>
        </div>
        {err && <p className="text-xs text-danger">{err}</p>}

        {!loaded ? (
          <p className="py-6 text-center text-xs text-ink-muted">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">
            Ninguém bloqueado ainda. Quem responder “pare” entra aqui automaticamente.
          </p>
        ) : (
          <div className="max-h-[45vh] space-y-1 overflow-y-auto">
            <p className="text-[11px] text-ink-faint">{rows.length} número(s) bloqueado(s)</p>
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md bg-canvas-deep/60 px-3 py-2 text-[12.5px]"
              >
                <span className="font-mono text-ink">{r.external_id}</span>
                <span className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      r.reason === "opt_out"
                        ? "bg-warning/15 text-warning"
                        : "bg-canvas-surface-2 text-ink-muted"
                    }`}
                  >
                    {REASON_LABEL[r.reason]}
                  </span>
                  <button
                    onClick={() => remove(r.external_id)}
                    className="p-1 text-ink-faint transition-colors hover:text-danger"
                    title="Desbloquear"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
