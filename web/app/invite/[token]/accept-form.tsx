"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full rounded-md border border-line bg-canvas-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-soft";

type AcceptOk = {
  type: "new_tenant" | "add_user";
  tenant: { slug: string; name: string };
  whatsapp: { qr_base64?: string | null; pairing_code?: string | null; already_exists?: boolean } | null;
  provision_error: string | null;
};

export function AcceptForm({
  token,
  type,
  role,
  lockedEmail,
  tenantName,
}: {
  token: string;
  type: "new_tenant" | "add_user";
  role: string;
  lockedEmail: string | null;
  tenantName: string | null;
}) {
  const isNewTenant = type === "new_tenant";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [password, setPassword] = useState("");
  // Empresa (só new_tenant)
  const [companyName, setCompanyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [agentName, setAgentName] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<AcceptOk | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: { name, email, password },
          company: isNewTenant
            ? {
                name: companyName,
                owner_whatsapp_e164: whatsapp,
                agent_name: agentName || undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "não foi possível concluir");
      setDone(data as AcceptOk);
    } catch (e2) {
      setErr(String(e2 instanceof Error ? e2.message : e2));
    } finally {
      setBusy(false);
    }
  };

  // ===== Sucesso =====
  if (done) {
    const qr = done.whatsapp?.qr_base64;
    const qrSrc = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;
    return (
      <div className="rounded-xl border border-line bg-canvas-surface p-6 text-center shadow-elevated">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-success/40 bg-success/10 text-success">
          ✓
        </div>
        <h2 className="font-serif text-lg text-ink">Conta criada!</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          {isNewTenant
            ? `A empresa ${done.tenant.name} foi criada e você é o responsável.`
            : `Você agora tem acesso a ${done.tenant.name}.`}
        </p>

        {isNewTenant && qrSrc && (
          <div className="mt-5 rounded-lg border border-line bg-canvas-deep p-4">
            <p className="text-xs font-medium text-ink-soft">Conecte o WhatsApp</p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Abra o WhatsApp da empresa → Aparelhos conectados → escaneie:
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR code do WhatsApp" className="mx-auto mt-3 h-48 w-48 rounded-md bg-white p-2" />
          </div>
        )}
        {isNewTenant && !qrSrc && (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
            A conexão do WhatsApp será feita pelo administrador no painel.
          </p>
        )}

        <a
          href="/login"
          className="mt-6 inline-block w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink-inverse transition-colors hover:bg-white"
        >
          Entrar no painel
        </a>
      </div>
    );
  }

  // ===== Formulário =====
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-canvas-surface p-6 shadow-elevated">
      <div className="mb-1">
        <h2 className="font-serif text-lg text-ink">
          {isNewTenant ? "Criar sua empresa" : "Criar seu acesso"}
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          {isNewTenant
            ? "Preencha os dados da empresa e crie seu login de responsável."
            : tenantName
              ? `Você foi convidado para ${tenantName} (${role}).`
              : `Você foi convidado como ${role}.`}
        </p>
      </div>

      {isNewTenant && (
        <>
          <label className="block">
            <span className={labelCls}>Nome da empresa</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
              placeholder="Ex: Facilita Imóveis"
              required
            />
          </label>
          <label className="block">
            <span className={labelCls}>WhatsApp da empresa</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={inputCls}
              placeholder="5541999999999 (com DDI e DDD)"
              required
            />
          </label>
          <label className="block">
            <span className={labelCls}>Nome da agente de IA (opcional)</span>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className={inputCls}
              placeholder="Ex: Sofia"
            />
          </label>
          <div className="my-2 border-t border-line" />
        </>
      )}

      <label className="block">
        <span className={labelCls}>Seu nome</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="Nome completo"
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>E-mail (login)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="voce@empresa.com"
          readOnly={!!lockedEmail}
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Senha</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          placeholder="mínimo 8 caracteres"
          minLength={8}
          required
        />
      </label>

      {err && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {err}
        </div>
      )}

      <Button type="submit" disabled={busy} className="w-full" size="lg">
        {busy ? "Criando…" : isNewTenant ? "Criar empresa e acesso" : "Criar meu acesso"}
      </Button>
      <p className="text-center text-[11px] text-ink-faint">Vita OS · systemvita.com.br</p>
    </form>
  );
}
