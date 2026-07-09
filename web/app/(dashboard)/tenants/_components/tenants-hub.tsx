"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Server, Wifi, WifiOff, Coins, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Field } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/badge";

type TenantSummary = {
  id: number;
  slug: string;
  name: string;
  evolution_instance: string;
  owner_name: string;
  playbook_slug: string | null;
  active: boolean;
  training_enabled: boolean;
};

type ProvisionResult = {
  tenant: { slug: string; name: string; evolution_instance: string; active: boolean };
  whatsapp: { qr_base64: string | null; pairing_code: string | null; already_exists: boolean } | null;
  provision_error: string | null;
};

const PLAYBOOKS = [
  { slug: "consorcio-sdr", label: "Consórcio (SDR)" },
  { slug: "imoveis-lancamento", label: "Imóveis — lançamento" },
  { slug: "home-equity", label: "Home equity" },
];

export function TenantsHub({ initial, error }: { initial: TenantSummary[]; error: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creditTenant, setCreditTenant] = useState<TenantSummary | null>(null);

  return (
    <div className="space-y-5">
      {/* Barra de ação */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {initial.length} {initial.length === 1 ? "instância" : "instâncias"} ativa(s) na plataforma
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> Provisionar novo tenant
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Tabela densa (estilo Linear/Vercel) */}
      <div className="overflow-hidden rounded-xl border border-line bg-canvas-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Instância (Evolution)</th>
              <th className="px-5 py-3 font-medium">Playbook</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-center font-medium">Treinamentos</th>
              <th className="px-5 py-3 text-right font-medium">Créditos</th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                  <Server size={28} className="mx-auto mb-3 text-ink-faint" strokeWidth={1.5} />
                  Nenhum tenant provisionado ainda.
                </td>
              </tr>
            )}
            {initial.map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-canvas-surface-2/50">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="text-[11px] text-ink-faint">{t.owner_name}</div>
                </td>
                <td className="px-5 py-3.5">
                  <code className="rounded border border-line bg-canvas-deep px-1.5 py-0.5 text-[11px] text-ink-soft">
                    {t.evolution_instance}
                  </code>
                </td>
                <td className="px-5 py-3.5 text-ink-soft">
                  {PLAYBOOKS.find((p) => p.slug === t.playbook_slug)?.label ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  {t.active ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <StatusDot className="bg-success" /> <Wifi size={13} /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-faint">
                      <StatusDot className="bg-ink-faint" /> <WifiOff size={13} /> Inativo
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <TrainingToggle tenant={t} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button size="sm" variant="outline" onClick={() => setCreditTenant(t)}>
                    <Coins size={13} /> Creditar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProvisionModal open={open} onClose={() => setOpen(false)} onDone={() => router.refresh()} />
      <CreditModal tenant={creditTenant} onClose={() => setCreditTenant(null)} />
    </div>
  );
}

// Libera/bloqueia a área de Treinamentos pro tenant (superadmin).
function TrainingToggle({ tenant }: { tenant: TenantSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch(`/api/admin-proxy/tenants/${tenant.slug}/training-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !tenant.training_enabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={tenant.training_enabled ? "Clique pra bloquear" : "Clique pra liberar"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        tenant.training_enabled
          ? "border-success/30 bg-success/10 text-success"
          : "border-line bg-canvas-deep text-ink-faint hover:border-accent-bronze/40 hover:text-ink-soft"
      }`}
    >
      <GraduationCap size={12} /> {tenant.training_enabled ? "Liberado" : "Bloqueado"}
    </button>
  );
}

type CreditTx = {
  id: number;
  amount: number;
  balance_after: number;
  kind: string;
  reason: string | null;
  created_at: string;
};

function CreditModal({ tenant, onClose }: { tenant: TenantSummary | null; onClose: () => void }) {
  const [credits, setCredits] = useState<{ balance: number; reserved: number } | null>(null);
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [amount, setAmount] = useState(500);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${slug}/credits`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCredits(data.credits);
        setTxs(data.transactions ?? []);
      }
    } catch {
      /* silencioso */
    }
  };

  useEffect(() => {
    if (tenant) {
      setCredits(null);
      setTxs([]);
      setErr(null);
      load(tenant.slug);
    }
  }, [tenant]);

  const submit = async () => {
    if (!tenant) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenant.slug}/credits/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao creditar");
      setReason("");
      await load(tenant.slug);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={tenant != null}
      onClose={onClose}
      title={tenant ? `Créditos · ${tenant.name}` : undefined}
      subtitle="1 crédito = 1 lead com telefone na busca de leads"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-accent-bronze/25 bg-accent-bronze/10 px-4 py-3">
          <span className="text-[13px] text-ink-soft">Saldo atual</span>
          <span className="flex items-center gap-2 font-serif text-2xl text-accent-bronze-soft">
            <Coins size={18} /> {credits ? credits.balance : "…"}
            {credits && credits.reserved > 0 && (
              <span className="text-xs text-ink-faint">+ {credits.reserved} em uso</span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Adicionar créditos">
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Motivo (opcional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: pacote inicial" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[100, 500, 1000, 5000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                amount === v
                  ? "border-accent-bronze/50 bg-accent-bronze/10 text-accent-bronze-soft"
                  : "border-line text-ink-soft hover:border-accent-bronze/30"
              }`}
            >
              +{v.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>

        {err && <p className="text-xs text-danger">{err}</p>}
        <Button variant="bronze" className="w-full" onClick={submit} disabled={busy || amount <= 0}>
          <Coins size={14} /> {busy ? "Creditando…" : `Creditar ${amount.toLocaleString("pt-BR")}`}
        </Button>

        {txs.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Últimos movimentos
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md bg-canvas-deep/60 px-3 py-1.5 text-xs">
                  <span className="text-ink-soft">
                    {t.kind === "topup" ? "Recarga" : t.kind === "debit" ? "Consumo" : "Ajuste"}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </span>
                  <span className={t.amount >= 0 ? "text-success" : "text-ink-muted"}>
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ProvisionModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [playbook, setPlaybook] = useState("imoveis-lancamento");
  const [agentName, setAgentName] = useState("Stella");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const reset = () => {
    setName("");
    setOwnerName("");
    setWhatsapp("");
    setResult(null);
    setErr(null);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin-proxy/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          owner_name: ownerName,
          owner_whatsapp_e164: whatsapp.replace(/\D/g, ""),
          playbook_slug: playbook,
          agent_name: agentName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro no provisionamento");
      setResult(data as ProvisionResult);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  // Estado 2: provisionado — mostra QR pra escanear.
  if (result) {
    const qr = result.whatsapp?.qr_base64;
    const qrSrc = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;
    return (
      <Modal
        open={open}
        onClose={() => {
          reset();
          onDone();
          onClose();
        }}
        title="Tenant provisionado"
        subtitle={`${result.tenant.name} · ${result.tenant.evolution_instance}`}
      >
        <div className="flex flex-col items-center text-center">
          {qrSrc ? (
            <>
              <div className="rounded-lg border border-line-strong bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR code WhatsApp" className="h-52 w-52" />
              </div>
              <p className="mt-4 text-[13px] text-ink-soft">
                Escaneie com o WhatsApp do cliente em <strong>Aparelhos conectados</strong>.
              </p>
            </>
          ) : result.whatsapp?.pairing_code ? (
            <div className="rounded-lg border border-line bg-canvas-deep px-6 py-5">
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">Código de pareamento</div>
              <div className="mt-2 font-serif text-2xl tracking-[0.2em] text-ink">
                {result.whatsapp.pairing_code}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-warning">
              {result.provision_error
                ? `Tenant criado, mas o Evolution falhou: ${result.provision_error}`
                : "Tenant criado. QR ainda não disponível — gere a conexão na instância."}
            </p>
          )}
          <p className="mt-3 text-[11px] text-ink-faint">
            Após conectar, ative o tenant na tabela de instâncias.
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              reset();
              onDone();
              onClose();
            }}
          >
            Concluir
          </Button>
        </div>
      </Modal>
    );
  }

  // Estado 1: formulário.
  return (
    <Modal open={open} onClose={onClose} title="Provisionar novo tenant" subtitle="Cria a instância e gera o QR de conexão">
      <div className="space-y-4">
        <Field label="Nome do cliente / imobiliária">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Apolar Imóveis Centro" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsável (owner)">
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="ex: Juan e Hugo" />
          </Field>
          <Field label="WhatsApp do owner (handoff)" hint="só números, com DDI+DDD">
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5541999998888" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Playbook (segmento)">
            <Select value={playbook} onChange={(e) => setPlaybook(e.target.value)}>
              {PLAYBOOKS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nome do agente">
            <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Stella" />
          </Field>
        </div>

        {err && <p className="text-[13px] text-danger">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !whatsapp.trim()}>
            {busy ? "Provisionando…" : "Provisionar e gerar QR"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
