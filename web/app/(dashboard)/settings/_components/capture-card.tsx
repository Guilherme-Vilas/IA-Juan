"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw } from "lucide-react";

export function CaptureCard() {
  const [data, setData] = useState<{ url: string; token: string; capture_greeting: string } | null>(null);
  const [greeting, setGreeting] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingG, setSavingG] = useState(false);

  async function load() {
    const r = await fetch("/api/ingest", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setData(d);
      setGreeting(d.capture_greeting ?? "");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function rotate() {
    if (!confirm("Gerar um novo token? O atual deixa de funcionar.")) return;
    const r = await fetch("/api/ingest/rotate", { method: "POST" });
    if (r.ok) load();
  }
  async function saveGreeting() {
    setSavingG(true);
    try {
      await fetch("/api/ingest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capture_greeting: greeting }),
      });
    } finally {
      setSavingG(false);
    }
  }

  const fullUrl = data ? `${data.url}?token=${data.token}` : "";
  const curl = data
    ? `curl -X POST "${fullUrl}" -H "Content-Type: application/json" \\\n  -d '{"name":"João","phone":"41999999999","source":"meta_ads","utm":{"campaign":"imoveis-curitiba"}}'`
    : "";

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Captura de leads</h2>
        <p className="text-xs text-ink-muted">
          Conecte formulários do site, widget ou Meta Lead Ads (via Zapier/Make) a este endpoint.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Endpoint (POST)</span>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={fullUrl}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border border-line bg-canvas-deep px-2.5 py-2 text-[12px] text-ink-soft"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(fullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 rounded-md border border-line px-2.5 text-[12px] text-ink-soft hover:bg-canvas-surface-2"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
            <button
              onClick={rotate}
              title="Gerar novo token"
              className="flex items-center gap-1 rounded-md border border-line px-2.5 text-[12px] text-ink-soft hover:bg-canvas-surface-2 hover:text-danger"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Exemplo</span>
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas-deep p-3 text-[11px] text-ink-muted">
            {curl}
          </pre>
          <p className="mt-1 text-[11px] text-ink-faint">
            Campos: name, phone (ou wa_id), source, utm{"{}"}, custom{"{}"}.
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">
            Saudação automática (opcional)
          </span>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            onBlur={saveGreeting}
            rows={2}
            placeholder="Mensagem enviada no WhatsApp quando um lead é capturado (deixe vazio para não enviar)"
            className="w-full resize-none rounded-md border border-line bg-canvas-deep px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
          {savingG && <p className="mt-1 text-[11px] text-ink-faint">salvando…</p>}
        </div>
      </CardBody>
    </Card>
  );
}
