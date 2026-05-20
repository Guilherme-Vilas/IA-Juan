"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/types";
import { Pause, Play, X, Phone } from "lucide-react";

export function ActionsBar({ lead, onAction }: { lead: Lead; onAction: () => void }) {
  const [busy, setBusy] = useState(false);

  async function act(body: object) {
    setBusy(true);
    try {
      const r = await fetch(`/api/leads/${lead.wa_id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) alert(await r.text());
      else onAction();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2">
      {lead.paused ? (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => act({ action: "reopen" })}>
          <Play size={14} /> Reativar IA
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: "pause" })}>
          <Pause size={14} /> Pausar IA
        </Button>
      )}

      {lead.status === "open" ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => act({ action: "close", reason: "not_interested" })}
          >
            <X size={14} /> Sem interesse
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => act({ action: "close", reason: "postponed" })}
          >
            <X size={14} /> Adiar
          </Button>
        </>
      ) : (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => act({ action: "reopen" })}>
          <Play size={14} /> Reabrir
        </Button>
      )}

      <a
        href={`https://wa.me/${lead.wa_id}`}
        target="_blank"
        className="ml-auto inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
      >
        <Phone size={12} /> Abrir no WhatsApp
      </a>
    </div>
  );
}
