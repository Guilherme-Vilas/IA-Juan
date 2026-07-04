"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  DISCOVERY_STATUS_COLORS,
  DISCOVERY_STATUS_LABELS,
  type DiscoveredLead,
  type DiscoverySearch,
} from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import {
  Radar,
  Rocket,
  Trash2,
  ExternalLink,
  Search,
  RotateCcw,
  ChevronRight,
  Users,
  Building2,
  Landmark,
  Stethoscope,
  Calculator,
  Scale,
  Eye,
  MessageCircle,
  Mail,
  MapPin,
} from "lucide-react";

// Perfis de cliente ideal — preenchem o formulário com filtros prontos.
const PRESETS = [
  { label: "Empresários", icon: Landmark, capitalMin: "100000", cnae: "", hint: "capital 100k+, qualquer setor" },
  { label: "Imobiliárias", icon: Building2, cnae: "6821801", capitalMin: "", hint: "corretagem de imóveis" },
  { label: "Construtoras", icon: Building2, cnae: "4120400", capitalMin: "", hint: "construção de edifícios" },
  { label: "Dentistas", icon: Stethoscope, cnae: "8630504", capitalMin: "", hint: "clínicas odontológicas" },
  { label: "Contadores", icon: Calculator, cnae: "6920601", capitalMin: "", hint: "escritórios de contabilidade" },
  { label: "Advogados", icon: Scale, cnae: "6911701", capitalMin: "", hint: "escritórios de advocacia" },
] as const;

export function DiscoveryHub({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [searches, setSearches] = useState<DiscoverySearch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [cnae, setCnae] = useState("");
  const [capitalMin, setCapitalMin] = useState("");
  const [quantity, setQuantity] = useState(100);

  // Visualizador de leads
  const [viewing, setViewing] = useState<DiscoverySearch | null>(null);
  const [leads, setLeads] = useState<DiscoveredLead[] | null>(null);

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
    setActivePreset(p.label);
    setName(p.label);
    setCnae(p.cnae);
    setCapitalMin(p.capitalMin);
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
      setActivePreset(null);
      await load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const exportSearch = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao exportar");
      router.push(`/prospect/${data.campaign_id}`);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setBusy(false);
    }
  };

  const retry = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`${base}/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "erro ao re-executar");
      }
      await load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  };

  const remove = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "erro ao excluir");
      }
      await load();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  };

  const openLeads = async (s: DiscoverySearch) => {
    setViewing(s);
    setLeads(null);
    try {
      const res = await fetch(`${base}/${s.id}`, { cache: "no-store" });
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch {
      setLeads([]);
    }
  };

  return (
    <div className="stagger grid gap-4 lg:grid-cols-3">
      {/* ===== Nova busca ===== */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-serif text-[15px] text-ink">
              <Radar size={15} className="text-accent-bronze-soft" /> Nova busca
            </h2>
            <p className="mt-1 text-[11px] text-ink-muted">
              Escolha o perfil do cliente ideal — a gente encontra, enriquece e valida.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Perfis prontos
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => {
                  const Icon = p.icon;
                  const active = activePreset === p.label;
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      title={p.hint}
                      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 ${
                        active
                          ? "border-accent-bronze/50 bg-accent-bronze/10 shadow-glow-bronze"
                          : "border-line bg-canvas-deep/50 hover:border-accent-bronze/30"
                      }`}
                    >
                      <Icon
                        size={14}
                        className={active ? "text-accent-bronze-soft" : "text-ink-muted group-hover:text-accent-bronze-soft"}
                      />
                      <span className={`text-[11.5px] ${active ? "text-ink" : "text-ink-soft"}`}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-bronze-line opacity-50" />

            <Field label="Nome da busca">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Empresários Curitiba" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="UF">
                <Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="PR, SC" />
              </Field>
              <Field label="Cidade">
                <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Curitiba" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNAE">
                <Input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="6821801" />
              </Field>
              <Field label="Capital mín. (R$)">
                <Input type="number" value={capitalMin} onChange={(e) => setCapitalMin(e.target.value)} placeholder="100000" />
              </Field>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-soft">Quantidade de leads</span>
                <span className="font-serif text-sm text-accent-bronze-soft">{quantity}</span>
              </div>
              <input
                type="range"
                min={20}
                max={300}
                step={20}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-[#B08D57]"
              />
              <div className="flex justify-between text-[10px] text-ink-faint">
                <span>20</span>
                <span>300</span>
              </div>
            </div>

            <Button variant="bronze" className="w-full" size="lg" onClick={create} disabled={busy || !name.trim()}>
              <Search size={14} /> {busy ? "Criando…" : "Buscar leads"}
            </Button>
            <p className="text-center text-[10px] leading-relaxed text-ink-faint">
              Empresas ativas · com telefone · sem MEI · WhatsApp validado antes da campanha
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ===== Buscas ===== */}
      <div className="space-y-3 lg:col-span-2">
        {error && (
          <p className="animate-fade-in rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        {!loaded ? (
          <div className="grid h-32 place-items-center text-sm text-ink-muted">Carregando…</div>
        ) : searches.length === 0 ? (
          <Card>
            <CardBody>
              <div className="grid place-items-center gap-3 py-14 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-accent-bronze/25 bg-accent-bronze/10">
                  <Radar size={24} className="text-accent-bronze-soft" />
                </div>
                <p className="font-serif text-xl text-ink">Seu motor de leads começa aqui.</p>
                <p className="max-w-sm text-xs leading-relaxed text-ink-muted">
                  Escolha um perfil ao lado, rode a busca e receba uma lista enriquecida com sócio, telefone
                  e WhatsApp validado — pronta pra virar campanha.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          searches.map((s) => (
            <SearchCard
              key={s.id}
              search={s}
              busy={busy}
              onView={() => openLeads(s)}
              onExport={() => exportSearch(s.id)}
              onRetry={() => retry(s.id)}
              onRemove={() => remove(s.id)}
              onOpenCampaign={() => router.push(`/prospect/${s.exported_campaign_id}`)}
            />
          ))
        )}
      </div>

      {/* ===== Visualizador de leads ===== */}
      <Modal
        open={viewing != null}
        onClose={() => setViewing(null)}
        title={viewing ? `Leads · ${viewing.name}` : undefined}
        subtitle={
          leads
            ? `${leads.length} empresas · ${leads.filter((l) => l.has_whatsapp).length} com WhatsApp validado`
            : "carregando…"
        }
        className="max-w-4xl"
      >
        {!leads ? (
          <div className="grid h-40 place-items-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent-bronze/30 border-t-accent-bronze" />
          </div>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum lead nessa busca ainda.</p>
        ) : (
          <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-canvas-surface">
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Empresa / Sócio</th>
                  <th className="py-2 pr-3 font-medium">Local</th>
                  <th className="py-2 pr-3 font-medium">Contato</th>
                  <th className="py-2 text-right font-medium">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line/50">
                    <td className="max-w-[240px] py-2 pr-3">
                      <div className="truncate font-medium text-ink">{l.company ?? l.cnpj}</div>
                      {l.contact_name && (
                        <div className="flex items-center gap-1 truncate text-ink-muted">
                          <Users size={10} /> {l.contact_name}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-ink-soft">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-ink-faint" />
                        {[l.city, l.uf].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">
                      <div>{l.phone_raw ?? "—"}</div>
                      {l.email && (
                        <div className="flex max-w-[180px] items-center gap-1 truncate text-[10px] text-ink-faint">
                          <Mail size={9} /> {l.email}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {l.has_whatsapp === true ? (
                        <Badge className="border-success/25 bg-success/15 text-success">
                          <MessageCircle size={10} /> sim
                        </Badge>
                      ) : l.has_whatsapp === false ? (
                        <Badge className="bg-canvas-surface-2 text-ink-faint">não</Badge>
                      ) : (
                        <Badge className="bg-canvas-surface-2 text-ink-faint">…</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===== Card de busca com funil visual =====

function SearchCard({
  search: s,
  busy,
  onView,
  onExport,
  onRetry,
  onRemove,
  onOpenCampaign,
}: {
  search: DiscoverySearch;
  busy: boolean;
  onView: () => void;
  onExport: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onOpenCampaign: () => void;
}) {
  const running = s.status === "running" || s.status === "queued";
  const phase =
    s.found_count === 0
      ? "Consultando a base de CNPJs…"
      : s.whatsapp_count === 0
        ? "Enriquecendo contatos (sócios, telefones, email)…"
        : "Validando números no WhatsApp…";

  return (
    <Card hoverable>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-serif text-[15px] text-ink">{s.name}</span>
              <Badge className={DISCOVERY_STATUS_COLORS[s.status]}>
                {running && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />}
                {DISCOVERY_STATUS_LABELS[s.status]}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {formatRelative(s.created_at)} · pedido: {s.requested_count}
              {filtersSummary(s.filters)}
            </p>
          </div>
          {s.status !== "running" && (
            <Button size="icon" variant="ghost" onClick={onRemove} title="Excluir busca">
              <Trash2 size={13} />
            </Button>
          )}
        </div>

        {/* Funil visual */}
        <div className="flex items-stretch gap-1.5">
          <FunnelTile label="Encontrados" value={s.found_count} />
          <ChevronRight size={14} className="self-center text-ink-faint" />
          <FunnelTile label="Com telefone" value={s.with_phone_count} pct={pct(s.with_phone_count, s.found_count)} />
          <ChevronRight size={14} className="self-center text-ink-faint" />
          <FunnelTile
            label="Com WhatsApp"
            value={s.whatsapp_count}
            pct={pct(s.whatsapp_count, s.with_phone_count)}
            highlight
          />
        </div>

        {running && (
          <div>
            <div className="h-1 overflow-hidden rounded-full bg-canvas-surface-2">
              <div
                className="h-full w-full animate-shimmer rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, transparent, rgba(176,141,87,0.7), transparent)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-ink-faint">{phase}</p>
          </div>
        )}

        {s.status === "failed" && s.error_msg && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-danger">
            {s.error_msg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {s.found_count > 0 && (
            <Button size="sm" variant="outline" onClick={onView}>
              <Eye size={12} /> Ver leads
            </Button>
          )}
          {s.status === "done" && !s.exported_campaign_id && s.whatsapp_count > 0 && (
            <Button size="sm" variant="bronze" onClick={onExport} disabled={busy}>
              <Rocket size={12} /> Criar campanha ({s.whatsapp_count})
            </Button>
          )}
          {s.exported_campaign_id && (
            <Button size="sm" variant="outline" onClick={onOpenCampaign}>
              <ExternalLink size={12} /> Ver campanha
            </Button>
          )}
          {s.status === "failed" && (
            <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}>
              <RotateCcw size={12} /> Tentar de novo
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function FunnelTile({
  label,
  value,
  pct,
  highlight,
}: {
  label: string;
  value: number;
  pct?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-lg p-2 text-center ${
        highlight ? "border border-accent-bronze/30 bg-accent-bronze/10" : "bg-canvas-deep/60"
      }`}
    >
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`font-serif text-xl leading-tight ${highlight ? "text-accent-bronze-soft" : "text-ink"}`}>
        {value}
      </div>
      {pct && <div className="text-[9px] text-ink-faint">{pct}</div>}
    </div>
  );
}

function pct(part: number, whole: number): string | undefined {
  if (!whole) return undefined;
  return `${Math.round((part / whole) * 100)}%`;
}

function filtersSummary(f: Record<string, unknown>): string {
  const parts: string[] = [];
  const list = (v: unknown) => (Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "");
  if (list(f["uf"])) parts.push(`UF ${list(f["uf"]).toUpperCase()}`);
  if (list(f["municipio"])) parts.push(list(f["municipio"]));
  if (list(f["cnae"])) parts.push(`CNAE ${list(f["cnae"])}`);
  if (f["capital_social_min"]) parts.push(`capital ≥ ${Number(f["capital_social_min"]).toLocaleString("pt-BR")}`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}
