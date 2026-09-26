"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toastError, toastSuccess } from "@/lib/toast";
import { Webhook, Trash2, Copy } from "lucide-react";

// Webhooks de saída: integrações do cliente (Zapier, Make, CRM externo).
// O secret completo só aparece UMA vez, na criação.

type Hook = {
  id: number;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  last_ok_at: string | null;
  last_error: string;
};

const EVENT_LABELS: Record<string, string> = {
  "lead.created": "Lead novo",
  "lead.scheduled": "Reunião marcada",
  "lead.won": "Negócio ganho",
  "lead.lost": "Negócio perdido",
  "appointment.no_show": "Não compareceu",
};

export function WebhooksManager({
  tenantSlug,
  initial,
  events,
}: {
  tenantSlug: string;
  initial: Hook[];
  events: string[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>(["lead.created"]);
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function create() {
    if (!url.trim()) return toastError("Informe a URL de destino.");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selected }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; webhook?: Hook };
      if (!res.ok) throw new Error(data.error || "falha ao criar webhook");
      setNewSecret(data.webhook?.secret ?? null);
      setUrl("");
      toastSuccess("Webhook criado. Guarde o secret — ele não aparece de novo.");
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Não consegui criar o webhook.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remover este webhook? A integração para de receber eventos.")) return;
    const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/webhooks/${id}`, { method: "DELETE" });
    if (!res.ok) return toastError("Não consegui remover o webhook.");
    toastSuccess("Webhook removido.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Webhook size={14} className="text-accent-bronze-soft" /> Integrações (webhooks de saída)
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Receba eventos em tempo real no seu Zapier, Make ou CRM. Cada entrega vai assinada com HMAC-SHA256 no
          header <code className="text-ink-soft">x-vita-signature</code>.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        {newSecret && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-bronze/40 bg-accent-bronze/10 p-3 text-xs">
            <span className="text-ink">Secret (copie agora — não aparece de novo):</span>
            <code className="break-all text-accent-bronze-soft">{newSecret}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(newSecret).then(
                  () => toastSuccess("Secret copiado."),
                  () => toastError("Não consegui copiar — selecione manualmente."),
                );
              }}
              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-ink-soft hover:text-ink"
            >
              <Copy size={11} /> Copiar
            </button>
          </div>
        )}

        {initial.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas-deep p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{h.url}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {h.events.map((e) => (
                  <Badge key={e} className="bg-canvas-surface-2 text-ink-soft">
                    {EVENT_LABELS[e] ?? e}
                  </Badge>
                ))}
              </div>
              {h.last_error && <div className="mt-1 text-[11px] text-danger">Última falha: {h.last_error}</div>}
            </div>
            <Badge className={h.enabled ? "bg-success/15 text-success" : "bg-canvas-surface-2 text-ink-muted"}>
              {h.enabled ? "Ativo" : "Pausado"}
            </Badge>
            <button
              onClick={() => remove(h.id)}
              aria-label={`Remover webhook ${h.url}`}
              className="rounded p-1.5 text-ink-muted hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
              aria-label="URL do webhook"
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas-deep px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            <Button onClick={create} disabled={busy}>
              {busy ? "Criando…" : "Adicionar"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {events.map((e) => {
              const sel = selected.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setSelected((prev) => (sel ? prev.filter((x) => x !== e) : [...prev, e]))}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                    sel
                      ? "border-accent-bronze/50 bg-accent-bronze/15 text-accent-bronze-soft"
                      : "border-line text-ink-muted hover:text-ink"
                  }`}
                >
                  {EVENT_LABELS[e] ?? e}
                </button>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
