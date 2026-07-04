"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import {
  DISCOVERY_STATUS_COLORS,
  DISCOVERY_STATUS_LABELS,
  type DiscoverySearch,
} from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { Radar, Rocket, Trash2, ExternalLink, Phone, MessageCircle, Search, RotateCcw } from "lucide-react";

// Presets de ICP — preenchem o formulário com filtros prontos pro nicho.
const PRESETS: Array<{ label: string; cnae?: string; capitalMin?: string; hint: string }> = [
  { label: "Empresários (capital 100k+)", capitalMin: "100000", hint: "qualquer setor, exclui MEI" },
  { label: "Imobiliárias", cnae: "6821801", hint: "corretagem de imóveis" },
  { label: "Construtoras", cnae: "4120400", hint: "construção de edifícios" },
  { label: "Dentistas", cnae: "8630504", hint: "atividade odontológica" },
  { label: "Contadores", cnae: "6920601", hint: "atividades de contabilidade" },
  { label: "Advogados", cnae: "6911701", hint: "escritórios de advocacia" },
];

export function DiscoveryHub({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [searches, setSearches] = useState<DiscoverySearch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [cnae, setCnae] = useState("");
  const [capitalMin, setCapitalMin] = useState("");
  const [quantity, setQuantity] = useState(100);

  const base = `/api/admin-proxy/tenants/${tenantSlug}/discovery`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSearches(data.searches ?? []);
      }
    } catch {
      /* silencioso */
    } finally {
      setLoaded(true);
    }
  }, [base]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setName(p.label);
    setCnae(p.cnae ?? "");
    setCapitalMin(p.capitalMin ?? "");
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          requested_count: quantity,
          filters: {
            uf,
            municipio,
            cnae,
            capital_social_min: capitalMin ? Number(capitalMin) : undefined,
            excluir_mei: true,
            somente_matriz: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao criar busca");
      setName("");
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportSearch = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${id}/export`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao exportar");
      router.push(`/prospect/${data.campaign_id}`);
    } catch (err) {
      setError(String(err));
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await fetch(`${base}/${id}`, { method: "DELETE" });
      await load();
    } catch {
      /* silencioso */
    }
  };

  const retry = async (id: number) => {
    try {
      await fetch(`${base}/${id}/retry`, { method: "POST" });
      await load();
    } catch {
      /* silencioso */
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Nova busca */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Radar size={14} className="text-accent-bronze-soft" /> Nova busca
            </h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  title={p.hint}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:border-accent-bronze/40 hover:text-accent-bronze-soft"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Field label="Nome da busca">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Empresários Curitiba" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="UF" hint="separa por vírgula">
                <Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="PR, SC" />
              </Field>
              <Field label="Cidade" hint="opcional">
                <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="CURITIBA" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNAE" hint="só dígitos, vírgula p/ vários">
                <Input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="6821801" />
              </Field>
              <Field label="Capital social mín. (R$)">
                <Input
                  type="number"
                  value={capitalMin}
                  onChange={(e) => setCapitalMin(e.target.value)}
                  placeholder="100000"
                />
              </Field>
            </div>
            <Field label={`Quantidade de leads: ${quantity}`}>
              <input
                type="range"
                min={20}
                max={300}
                step={20}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-[#B08D57]"
              />
            </Field>

            <p className="text-[11px] leading-relaxed text-ink-faint">
              Só empresas ativas com telefone. A lista é enriquecida (sócios, email) e o WhatsApp de cada
              número é validado antes de virar campanha.
            </p>

            {error && <p className="text-xs text-danger">{error}</p>}
            <Button variant="bronze" className="w-full" onClick={create} disabled={busy || !name.trim()}>
              <Search size={14} /> {busy ? "Criando…" : "Buscar leads"}
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Buscas */}
      <div className="space-y-3 lg:col-span-2">
        {!loaded ? (
          <div className="grid h-32 place-items-center text-sm text-ink-muted">Carregando…</div>
        ) : searches.length === 0 ? (
          <Card>
            <CardBody>
              <div className="grid place-items-center gap-2 py-10 text-center">
                <Radar size={28} className="text-accent-bronze/50" />
                <p className="font-serif text-lg text-ink">Seu motor de leads começa aqui.</p>
                <p className="max-w-sm text-xs text-ink-muted">
                  Escolha um perfil de cliente ideal ao lado, rode a busca e receba uma lista validada
                  pronta pra prospecção.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          searches.map((s) => (
            <Card key={s.id} hoverable>
              <CardBody className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{s.name}</span>
                      <Badge className={DISCOVERY_STATUS_COLORS[s.status]}>
                        {s.status === "running" && (
                          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
                        )}
                        {DISCOVERY_STATUS_LABELS[s.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {formatRelative(s.created_at)} · pedido: {s.requested_count} leads
                      {filtersSummary(s.filters)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {s.status === "done" && !s.exported_campaign_id && s.whatsapp_count > 0 && (
                      <Button size="sm" variant="bronze" onClick={() => exportSearch(s.id)} disabled={busy}>
                        <Rocket size={12} /> Criar campanha ({s.whatsapp_count})
                      </Button>
                    )}
                    {s.exported_campaign_id && (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/prospect/${s.exported_campaign_id}`)}>
                        <ExternalLink size={12} /> Ver campanha
                      </Button>
                    )}
                    {s.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => retry(s.id)} disabled={busy}>
                        <RotateCcw size={12} /> Tentar de novo
                      </Button>
                    )}
                    {s.status !== "running" && (
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)} title="Excluir busca">
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Stat icon={<Search size={12} />} label="Encontrados" value={s.found_count} />
                  <Stat icon={<Phone size={12} />} label="Com telefone" value={s.with_phone_count} />
                  <Stat
                    icon={<MessageCircle size={12} />}
                    label="Com WhatsApp"
                    value={s.whatsapp_count}
                    highlight
                  />
                </div>

                {s.status === "failed" && s.error_msg && (
                  <p className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger">
                    {s.error_msg}
                  </p>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function filtersSummary(f: Record<string, unknown>): string {
  const parts: string[] = [];
  const list = (v: unknown) => (Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "");
  if (list(f["uf"])) parts.push(`UF ${list(f["uf"])}`);
  if (list(f["municipio"])) parts.push(list(f["municipio"]));
  if (list(f["cnae"])) parts.push(`CNAE ${list(f["cnae"])}`);
  if (f["capital_social_min"]) parts.push(`capital ≥ ${Number(f["capital_social_min"]).toLocaleString("pt-BR")}`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? "bg-accent-bronze/10" : "bg-canvas-deep/60"}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-muted">
        {icon} {label}
      </div>
      <div className={`font-serif text-lg ${highlight ? "text-accent-bronze-soft" : "text-ink"}`}>{value}</div>
    </div>
  );
}
