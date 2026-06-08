"use client";

import { Badge } from "@/components/ui/badge";
import { REASON_LABELS, type Lead } from "@/lib/types";
import { formatCurrency, formatRelative } from "@/lib/utils";
import { Pause, Phone, Video, MessageSquare, MapPin } from "lucide-react";

const SCORE_BADGES: Record<Lead["score_label"], string> = {
  frio: "bg-slate-100 text-slate-700",
  morno: "bg-amber-100 text-amber-700",
  quente: "bg-orange-100 text-orange-700",
  pronto: "bg-emerald-100 text-emerald-700",
};

export function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
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
      className="group rounded-md border border-line bg-white p-3 text-left text-sm shadow-sm hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-ink">{name}</span>
            {lead.paused && (
              <span title="IA pausada" className="text-warn">
                <Pause size={14} />
              </span>
            )}
          </div>
          <div className="truncate text-xs text-ink-muted">{lead.wa_id}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge className={SCORE_BADGES[lead.score_label]}>
          {lead.score_label} · {lead.score}
        </Badge>
        {lead.slots.interesse && (
          <Badge className="bg-slate-100 text-slate-700">{lead.slots.interesse}</Badge>
        )}
        {lead.slots.valor_bem && (
          <Badge className="bg-emerald-50 text-emerald-700">
            {formatCurrency(lead.slots.valor_bem)}
          </Badge>
        )}
        {lead.slots.mora_exterior && (
          <Badge className="bg-blue-50 text-blue-700">
            <MapPin size={10} /> exterior
          </Badge>
        )}
        {lead.status === "closed" && lead.closed_reason && (
          <Badge className="bg-red-50 text-red-700">{REASON_LABELS[lead.closed_reason]}</Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
        <span className="flex items-center gap-1">
          <MessageSquare size={11} />
          {formatRelative(lead.last_user_at ?? lead.last_assistant_at ?? lead.updated_at)}
        </span>
        {lead.slots.fecha_se_proposta_boa && (
          <span className="text-emerald-600">★ qualificado</span>
        )}
      </div>
    </button>
  );
}
