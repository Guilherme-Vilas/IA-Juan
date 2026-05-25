"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  type Campaign,
  type CampaignMetrics,
  type Prospect,
} from "@/lib/types";
import { Copy, ExternalLink, Pause, Play, Upload, Eye } from "lucide-react";

const CSV_PLACEHOLDER_WA = `nome,telefone,empresa,cargo
João Silva,(11) 99999-1234,Acme,Diretor
Maria Souza,11988887777,Beta SA,Sócia`;

const CSV_PLACEHOLDER_LI = `nome,linkedin_url,empresa,cargo
João Silva,https://www.linkedin.com/in/joao-silva/,Acme,Diretor
Maria Souza,maria-souza,Beta SA,Sócia`;

type Preview = { prospect: { id: number; nome: string | null; empresa: string | null; external_id: string }; message: string };

export function CampaignDetail({
  campaign,
  metrics,
  prospects,
}: {
  campaign: Campaign;
  metrics: CampaignMetrics;
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [uploadResult, setUploadResult] = useState<{ inserted: number; duplicates: number; invalid: { row: number; reason: string }[] } | null>(null);
  const [previews, setPreviews] = useState<Preview[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const csvPlaceholder = campaign.channel === "whatsapp" ? CSV_PLACEHOLDER_WA : CSV_PLACEHOLDER_LI;

  async function call(path: string, init?: RequestInit) {
    const res = await fetch(`/api/admin-proxy/${path}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...init,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "erro");
    return data;
  }

  const upload = async () => {
    setBusy(true);
    setError(null);
    setUploadResult(null);
    try {
      const data = await call(`campaigns/${campaign.id}/prospects`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setUploadResult(data);
      setCsv("");
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await call(`campaigns/${campaign.id}/preview`, {
        method: "POST",
        body: JSON.stringify({ limit: 3 }),
      });
      setPreviews(data.previews ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const action = async (act: "start" | "pause") => {
    setBusy(true);
    setError(null);
    try {
      await call(`campaigns/${campaign.id}/${act}`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const markSent = async (prospectId: number) => {
    try {
      await call(`prospects/${prospectId}/mark-sent`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(String(err));
    }
  };

  const skip = async (prospectId: number) => {
    try {
      await call(`prospects/${prospectId}/skip`, {
        method: "POST",
        body: JSON.stringify({ reason: "manual" }),
      });
      router.refresh();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Coluna esquerda: status + ações */}
      <div className="space-y-4 lg:col-span-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Status</h2>
              <Badge className={`${CAMPAIGN_STATUS_COLORS[campaign.status]} text-white`}>
                {CAMPAIGN_STATUS_LABELS[campaign.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Total" value={metrics.total} />
              <Metric label="Pendente" value={metrics.pending} />
              <Metric label="Na fila" value={metrics.queued} />
              <Metric label="Enviadas" value={metrics.sent} />
              <Metric label="Respondeu" value={metrics.replied} highlight />
              <Metric label="Falhou" value={metrics.failed} />
              <Metric label="Pulado" value={metrics.skipped} />
              <Metric label="Manual" value={metrics.ready_for_manual} />
            </div>
            <div className="flex gap-2">
              {campaign.status !== "running" && (
                <Button onClick={() => action("start")} disabled={busy} className="flex-1">
                  <Play size={14} /> Iniciar
                </Button>
              )}
              {campaign.status === "running" && (
                <Button onClick={() => action("pause")} disabled={busy} variant="outline" className="flex-1">
                  <Pause size={14} /> Pausar
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Template</h2>
          </CardHeader>
          <CardBody>
            <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs">
              {campaign.template_text}
            </pre>
            <p className="mt-2 text-xs text-ink-muted">
              {campaign.ai_refine ? "IA refina cada msg · " : ""}
              Tom: {campaign.tone} ·{" "}
              {campaign.work_hours_only ? "Só horário comercial" : "24/7"}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Coluna direita: upload + preview + prospects */}
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Importar leads (CSV)</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <textarea
              className="h-40 w-full rounded-md border border-line px-3 py-2 font-mono text-xs"
              placeholder={csvPlaceholder}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">
                Header obrigatório: <code>{campaign.channel === "whatsapp" ? "telefone" : "linkedin_url"}</code>
                . Opcionais: nome, empresa, cargo + qualquer coluna extra.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={preview} disabled={busy || metrics.pending === 0}>
                  <Eye size={14} /> Preview msg
                </Button>
                <Button onClick={upload} disabled={busy || !csv.trim()}>
                  <Upload size={14} /> Importar
                </Button>
              </div>
            </div>
            {uploadResult && (
              <div className="rounded bg-slate-50 p-2 text-xs">
                <p>
                  Importados: <strong>{uploadResult.inserted}</strong> · Duplicados:{" "}
                  <strong>{uploadResult.duplicates}</strong> · Inválidos:{" "}
                  <strong>{uploadResult.invalid.length}</strong>
                </p>
                {uploadResult.invalid.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-danger">
                    {uploadResult.invalid.slice(0, 5).map((inv, i) => (
                      <li key={i}>
                        linha {inv.row}: {inv.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {previews && previews.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Preview de mensagens</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {previews.map((p, i) => (
                <div key={i} className="rounded border border-line p-3">
                  <p className="mb-1 text-xs text-ink-muted">
                    {p.prospect.nome ?? p.prospect.external_id}
                    {p.prospect.empresa ? ` · ${p.prospect.empresa}` : ""}
                  </p>
                  <p className="text-sm">{p.message}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">
              Prospects ({prospects.length})
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {prospects.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-muted">
                Nenhum prospect importado ainda.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {prospects.map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    channel={campaign.channel}
                    onMarkSent={() => markSent(p.id)}
                    onSkip={() => skip(p.id)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded p-2 ${highlight ? "bg-emerald-50" : "bg-slate-50"}`}>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`text-base font-semibold ${highlight ? "text-emerald-700" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function ProspectRow({
  prospect,
  channel,
  onMarkSent,
  onSkip,
}: {
  prospect: Prospect;
  channel: "whatsapp" | "linkedin";
  onMarkSent: () => void;
  onSkip: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    if (!prospect.composed_message) return;
    await navigator.clipboard.writeText(prospect.composed_message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkedinUrl =
    channel === "linkedin"
      ? `https://www.linkedin.com/in/${prospect.external_id}/`
      : null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {prospect.nome ?? prospect.external_id}
            </span>
            <Badge className={PROSPECT_STATUS_COLORS[prospect.status]}>
              {PROSPECT_STATUS_LABELS[prospect.status]}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            {prospect.external_id}
            {prospect.empresa ? ` · ${prospect.empresa}` : ""}
            {prospect.cargo ? ` · ${prospect.cargo}` : ""}
          </p>
          {prospect.composed_message && (
            <p className="mt-1 text-xs text-ink-muted line-clamp-2">
              {prospect.composed_message}
            </p>
          )}
          {prospect.skip_reason && (
            <p className="mt-1 text-xs text-amber-700">Motivo: {prospect.skip_reason}</p>
          )}
          {prospect.error_msg && (
            <p className="mt-1 text-xs text-danger">Erro: {prospect.error_msg}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {prospect.status === "ready_for_manual" && linkedinUrl && (
            <>
              <Button size="sm" variant="outline" onClick={copyMessage}>
                <Copy size={12} /> {copied ? "Copiado!" : "Copiar"}
              </Button>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs hover:bg-slate-50"
              >
                <ExternalLink size={12} /> Abrir
              </a>
              <Button size="sm" onClick={onMarkSent}>
                Enviei
              </Button>
            </>
          )}
          {prospect.status === "pending" && (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              Pular
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
