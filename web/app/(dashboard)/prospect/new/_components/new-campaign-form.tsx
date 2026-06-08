"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NewCampaignForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "linkedin">("whatsapp");
  const [template, setTemplate] = useState(
    "Oi {{primeiro_nome}}, vi que voce trabalha na {{empresa}}. Posso te mandar 2 perguntas rapidas sobre consorcio?",
  );
  const [aiRefine, setAiRefine] = useState(true);
  const [tone, setTone] = useState("semi-formal");
  const [ratePerDay, setRatePerDay] = useState(30);
  const [workHoursOnly, setWorkHoursOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          template_text: template,
          ai_refine: aiRefine,
          tone,
          rate_per_day: ratePerDay,
          work_hours_only: workHoursOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro");
      router.push(`/prospect/${data.campaign.id}`);
    } catch (err) {
      setError(String(err));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Configuração</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Nome da campanha</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="ex: Empresários SP - Janeiro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Canal</label>
            <div className="flex gap-2">
              {(["whatsapp", "linkedin"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize ${
                    channel === ch
                      ? "border-brand-600 bg-brand-600/15 text-brand-300"
                      : "border-line bg-canvas-surface text-ink hover:bg-canvas-surface"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
            {channel === "linkedin" && (
              <p className="mt-1 text-xs text-warning">
                LinkedIn: por enquanto modo manual — sistema gera mensagem, você abre o LinkedIn e envia.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Template da mensagem
            </label>
            <textarea
              className="h-32 w-full rounded-md border border-line px-3 py-2 font-mono text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted">
              Variáveis disponíveis:{" "}
              <code className="rounded bg-canvas-surface-2 px-1">{`{{nome}}`}</code>{" "}
              <code className="rounded bg-canvas-surface-2 px-1">{`{{primeiro_nome}}`}</code>{" "}
              <code className="rounded bg-canvas-surface-2 px-1">{`{{empresa}}`}</code>{" "}
              <code className="rounded bg-canvas-surface-2 px-1">{`{{cargo}}`}</code>{" "}
              · qualquer coluna extra do CSV vira variável também
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aiRefine}
                onChange={(e) => setAiRefine(e.target.checked)}
              />
              <span>IA refina cada mensagem (Llama)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={workHoursOnly}
                onChange={(e) => setWorkHoursOnly(e.target.checked)}
              />
              <span>Só em horário comercial (9h-19h, seg-sex)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Tom</label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="semi-formal">Semi-formal</option>
                <option value="formal">Formal</option>
                <option value="descontraido">Descontraído</option>
                <option value="direto">Direto e curto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Envios por dia (máx)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                value={ratePerDay}
                onChange={(e) => setRatePerDay(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => history.back()}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy || !name.trim() || !template.trim()}>
              {busy ? "Criando..." : "Criar campanha"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
