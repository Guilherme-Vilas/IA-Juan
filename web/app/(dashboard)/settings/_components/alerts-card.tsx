"use client";

import { useState } from "react";
import { BellRing, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toastError, toastSuccess } from "@/lib/toast";

export type AlertSettings = {
  enabled: boolean;
  whatsapp_e164: string;
  owner_whatsapp_e164: string;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin-proxy${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "erro");
  return data;
}

export function AlertsCard({ tenantSlug, initial }: { tenantSlug: string; initial: AlertSettings }) {
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [number, setNumber] = useState(initial.whatsapp_e164);

  async function save() {
    setBusy(true);
    try {
      await api(`/tenants/${tenantSlug}/alerts`, {
        method: "PATCH",
        body: JSON.stringify({ enabled, whatsapp_e164: number }),
      });
      toastSuccess("Alertas atualizados");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-accent-bronze" />
          <h2 className="text-sm font-semibold">Alertas no WhatsApp</h2>
        </div>
        <Button onClick={() => void save()} disabled={busy}>
          <Save size={15} /> Salvar
        </Button>
      </CardHeader>
      <CardBody className="grid gap-4">
        <p className="text-sm text-ink-muted">
          Quando a IA agenda uma reunião, faz handoff ou cria uma tarefa, ela avisa no WhatsApp com os dados
          do lead (nome, contato, dia/horário e qualificação) pra pessoa seguir o atendimento no número dela.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-accent-bronze"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-medium">Enviar alertas no WhatsApp</span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Número dos alertas</span>
          <input
            className="h-10 rounded-md border border-line px-3"
            placeholder={`vazio = número do dono (${initial.owner_whatsapp_e164 || "não configurado"})`}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            disabled={!enabled}
            inputMode="numeric"
          />
          <span className="text-xs text-ink-muted">
            Só dígitos, com DDI e DDD — ex: 5541999998888. Se o lead tiver um vendedor atribuído com WhatsApp
            cadastrado, o alerta vai direto pro vendedor; este número é o destino padrão.
          </span>
        </label>
      </CardBody>
    </Card>
  );
}
