"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePolling } from "@/lib/use-polling";
import { Activity, AlertTriangle, Smartphone } from "lucide-react";

type TenantHealth = {
  slug: string;
  name: string;
  whatsapp: string;
  llm_used_today: number;
  llm_cap: number;
  leads_waiting: number;
};
type QueueHealth = { name: string; waiting: number; active: number; delayed: number; failed: number };
type Health = { tenants: TenantHealth[]; queues: QueueHealth[]; generated_at: string };

const WA_UI: Record<string, { label: string; cls: string }> = {
  open: { label: "Conectado", cls: "bg-success/15 text-success" },
  connecting: { label: "Reconectando", cls: "bg-warning/15 text-warning" },
  close: { label: "DESCONECTADO", cls: "bg-danger/20 text-danger" },
  unknown: { label: "Sem sinal ainda", cls: "bg-canvas-surface-2 text-ink-muted" },
};

const QUEUE_LABELS: Record<string, string> = {
  inbound: "Mensagens recebidas",
  followup: "Follow-ups",
  "retry-turn": "Re-tentativas da IA",
  "prospect-send": "Disparos de campanha",
  "webhook-deliver": "Webhooks de saída",
};

export function HealthBoard({ tenantSlug }: { tenantSlug: string }) {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin-proxy/platform/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Health);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  usePolling(load, 30_000);

  if (error && !data) {
    return (
      <Card>
        <CardBody className="text-sm text-danger">Erro ao carregar a saúde: {error}</CardBody>
      </Card>
    );
  }
  if (!data) {
    return <div className="grid h-40 place-items-center text-sm text-ink-muted">Carregando…</div>;
  }

  const problemQueues = data.queues.filter((q) => q.failed > 0 || q.waiting > 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone size={14} className="text-accent-bronze-soft" /> Clientes
          </h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="py-1.5 pr-2 font-medium">Cliente</th>
                <th className="py-1.5 pr-2 font-medium">WhatsApp</th>
                <th className="py-1.5 pr-2 text-right font-medium">IA hoje (tokens)</th>
                <th className="py-1.5 text-right font-medium">Leads sem resposta 15min+</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => {
                const wa = WA_UI[t.whatsapp] ?? WA_UI.unknown!;
                const llmPct = t.llm_cap ? Math.round((t.llm_used_today / t.llm_cap) * 100) : 0;
                return (
                  <tr key={t.slug} className="border-b border-line/50">
                    <td className="py-2 pr-2 text-ink">{t.name}</td>
                    <td className="py-2 pr-2">
                      <Badge className={wa.cls}>{wa.label}</Badge>
                    </td>
                    <td className={`py-2 pr-2 text-right ${llmPct >= 80 ? "text-warning" : "text-ink"}`}>
                      {t.llm_used_today.toLocaleString("pt-BR")}
                      {t.llm_cap > 0 && <span className="text-ink-faint"> ({llmPct}%)</span>}
                    </td>
                    <td className={`py-2 text-right ${t.leads_waiting > 0 ? "text-danger" : "text-ink"}`}>
                      <span className="inline-flex items-center gap-1">
                        {t.leads_waiting > 0 && <AlertTriangle size={11} aria-label="Leads esperando" />}
                        {t.leads_waiting}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={14} className="text-accent-bronze-soft" /> Filas de processamento
          </h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {data.queues.map((q) => {
              const bad = q.failed > 0;
              return (
                <div
                  key={q.name}
                  className={`rounded-lg p-3 ${bad ? "border border-danger/40 bg-danger/10" : "bg-canvas-deep/60"}`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">
                    {QUEUE_LABELS[q.name] ?? q.name}
                  </div>
                  <div className="mt-1 font-serif text-lg text-ink">
                    {q.waiting < 0 ? "—" : q.waiting + q.active + q.delayed}
                  </div>
                  <div className="text-[10px] text-ink-soft">
                    {q.active >= 0 && `${q.active} rodando · ${q.delayed} agendados`}
                    {q.failed > 0 && <span className="text-danger"> · {q.failed} FALHARAM</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {problemQueues.length === 0 && (
            <p className="mt-2 text-[11px] text-ink-faint">Nenhuma fila com falhas ou acúmulo. ✅</p>
          )}
        </CardBody>
      </Card>

      <p className="text-[11px] text-ink-faint">
        Atualizado {new Date(data.generated_at).toLocaleTimeString("pt-BR")} · "Leads sem resposta" = lead aberto cuja
        última mensagem é dele há 15+ min (a IA deveria ter respondido).
      </p>
    </div>
  );
}
