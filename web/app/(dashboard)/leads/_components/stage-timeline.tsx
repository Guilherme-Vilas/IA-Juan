"use client";

import { useEffect, useState } from "react";
import type { StageEvent } from "@/lib/types";
import { Bot, User, Cog } from "lucide-react";

const ACTOR_META: Record<StageEvent["actor"], { label: string; icon: typeof Bot; cls: string }> = {
  ai: { label: "IA", icon: Bot, cls: "text-accent-bronze" },
  human: { label: "Humano", icon: User, cls: "text-info" },
  system: { label: "Sistema", icon: Cog, cls: "text-ink-muted" },
};

export function StageTimeline({ waId }: { waId: string }) {
  const [events, setEvents] = useState<StageEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/leads/${waId}/stage-events`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => alive && setEvents(d.events ?? []))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [waId]);

  if (events === null) return <div className="py-6 text-center text-xs text-ink-muted">Carregando…</div>;
  if (events.length === 0)
    return <div className="py-6 text-center text-xs text-ink-muted">Sem movimentações ainda.</div>;

  return (
    <div className="space-y-3 py-3">
      {events.map((e) => {
        const meta = ACTOR_META[e.actor];
        const Icon = meta.icon;
        return (
          <div key={e.id} className="flex gap-3">
            <div className={`mt-0.5 ${meta.cls}`}>
              <Icon size={15} />
            </div>
            <div className="min-w-0 flex-1 border-b border-line/60 pb-3">
              <div className="text-sm text-ink">
                {e.from_stage_name ? `${e.from_stage_name} → ` : "Entrou em "}
                <span className="font-medium">{e.to_stage_name ?? "—"}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
                <span className={meta.cls}>{meta.label}</span>
                {e.reason && <span>· {e.reason}</span>}
                <span className="ml-auto">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
