"use client";

import { Badge } from "@/components/ui/badge";
import { REASON_LABELS, type Lead } from "@/lib/types";
import { formatCurrency, formatRelative } from "@/lib/utils";
import { Pause, MessageSquare, MapPin, Clock, Trophy, XCircle } from "lucide-react";

const SCORE_BADGES: Record<Lead["score_label"], string> = {
  frio: "bg-canvas-surface-2 text-ink-soft",
  morno: "bg-warning/15 text-warning border-warning/20",
  quente: "bg-orange-400/15 text-orange-300 border-orange-400/25",
  pronto: "bg-success/15 text-success border-success/25",
};

// leads quentes/prontos pulsam — o olho vai direto neles
const HOT = new Set<Lead["score_label"]>(["quente", "pronto"]);

export function LeadCard({
  lead,
  onClick,
  ageLabel,
  stale,
  assigneeName,
}: {
  lead: Lead;
  onClick: () => void;
  ageLabel?: string;
  stale?: boolean;
  assigneeName?: string;
}) {
  const name = lead.nome ?? lead.slots.nome ?? lead.wa_id;
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <button
      onClick={onClick}
      className="group relative w-full rounded-lg border border-line bg-gradient-to-b from-canvas-surface to-canvas-surface/70 p-3 text-left text-sm shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:border-accent-bronze/35 hover:shadow-glow-bronze"
    >
      <div className="flex items-start gap-2">
        {/* avatar com anel bronze — a luz da marca em cada lead */}
        <div className="shrink-0 rounded-full bg-gradient-to-b from-accent-bronze/50 to-transparent p-px">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-canvas-surface-2 text-xs font-semibold text-accent-bronze-soft">
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-ink">{name}</span>
            {lead.paused && (
              <span title="IA pausada" className="text-warning">
                <Pause size={14} />
              </span>
            )}
          </div>
          <div className="truncate text-xs text-ink-muted">{lead.wa_id}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge className={SCORE_BADGES[lead.score_label]}>
          {HOT.has(lead.score_label) && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping-dot rounded-full bg-current" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          )}
          {lead.score_label} · {lead.score}
        </Badge>
        {lead.slots.interesse && (
          <Badge className="bg-canvas-surface-2 text-ink">{lead.slots.interesse}</Badge>
        )}
        {lead.source && lead.source !== "whatsapp" && (
          <Badge className="bg-info/10 text-info">{lead.source}</Badge>
        )}
        {lead.value_cents != null && (
          <Badge className="border-accent-bronze/25 bg-accent-bronze/15 text-accent-bronze-soft">
            {formatCurrency(lead.value_cents / 100)}
          </Badge>
        )}
        {lead.value_cents == null && lead.slots.valor_bem && (
          <Badge className="bg-success/10 text-success">
            {formatCurrency(lead.slots.valor_bem)}
          </Badge>
        )}
        {lead.slots.mora_exterior && (
          <Badge className="bg-info/10 text-info">
            <MapPin size={10} /> exterior
          </Badge>
        )}
        {lead.outcome === "won" && (
          <Badge className="border-success/25 bg-success/15 text-success">
            <Trophy size={10} /> Ganho
          </Badge>
        )}
        {lead.outcome === "lost" && (
          <Badge className="border-danger/25 bg-danger/15 text-danger">
            <XCircle size={10} /> Perdido
          </Badge>
        )}
        {!lead.outcome && lead.status === "closed" && lead.closed_reason && (
          <Badge className="bg-danger/10 text-danger">{REASON_LABELS[lead.closed_reason]}</Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
        <span className="flex items-center gap-1">
          <MessageSquare size={11} />
          {formatRelative(lead.last_user_at ?? lead.last_assistant_at ?? lead.updated_at)}
        </span>
        {ageLabel && (
          <span
            className={`flex items-center gap-1 ${stale ? "font-medium text-danger" : ""}`}
            title="Tempo nesta etapa"
          >
            <Clock size={11} />
            {ageLabel}
          </span>
        )}
      </div>

      {assigneeName && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-line/60 pt-2 text-[11px] text-ink-muted">
          <span
            className="grid h-4 w-4 place-items-center rounded-full bg-canvas-surface-2 text-[8px] font-semibold text-ink"
            title="Responsável"
          >
            {assigneeName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{assigneeName}</span>
        </div>
      )}
    </button>
  );
}
