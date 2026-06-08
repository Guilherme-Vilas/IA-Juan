"use client";

import { useEffect, useState } from "react";
import { FSM_STATES, STATE_COLORS, STATE_LABELS, type Lead, type LeadState } from "@/lib/types";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";

const COLUMNS: LeadState[] = FSM_STATES;

export function LeadsBoard({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);

  // poll a cada 5s pra refletir mudanças (lead novo, FSM avançou, etc.)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/leads", { cache: "no-store" });
        if (res.ok) setLeads(await res.json());
      } catch {
        // silencioso
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const byState = COLUMNS.map((state) => ({
    state,
    leads: leads.filter((l) => l.state === state && l.status === "open"),
  }));

  const closed = leads.filter((l) => l.status === "closed");

  return (
    <>
      <div className="flex h-full gap-3 overflow-x-auto px-4 py-4">
        {byState.map(({ state, leads: col }) => (
          <Column key={state} state={state} leads={col} onSelect={setSelected} />
        ))}
        <Column state="CLOSED" leads={closed} onSelect={setSelected} closed />
      </div>

      <LeadDrawer
        waId={selected}
        onClose={() => setSelected(null)}
        onChange={async () => {
          // após qualquer ação, força refresh
          const res = await fetch("/api/leads", { cache: "no-store" });
          if (res.ok) setLeads(await res.json());
        }}
      />
    </>
  );
}

function Column({
  state,
  leads,
  onSelect,
  closed = false,
}: {
  state: LeadState | "CLOSED";
  leads: Lead[];
  onSelect: (waId: string) => void;
  closed?: boolean;
}) {
  const color = closed ? "bg-slate-400" : STATE_COLORS[state as LeadState];
  const label = closed ? "Fechados" : STATE_LABELS[state as LeadState];
  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-canvas-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink">{label}</span>
        </div>
        <span className="text-xs text-ink-muted">{leads.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {leads.length === 0 ? (
          <div className="grid h-24 place-items-center text-xs text-ink-muted">vazio</div>
        ) : (
          <div className="flex flex-col gap-2">
            {leads.map((l) => (
              <LeadCard key={l.wa_id} lead={l} onClick={() => onSelect(l.wa_id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
