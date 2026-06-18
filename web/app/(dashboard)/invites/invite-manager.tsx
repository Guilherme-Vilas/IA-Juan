"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Copy, Trash2, Link2 } from "lucide-react";

const inputCls =
  "w-full rounded-md border border-line bg-canvas-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-soft";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "sdr", label: "SDR" },
  { value: "viewer", label: "Viewer" },
];

export type InviteRow = {
  id: number;
  type: "new_tenant" | "add_user";
  role: string;
  email: string | null;
  note: string;
  status: "valid" | "used" | "expired";
  tenant: { slug: string; name: string } | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: InviteRow["status"] }) {
  const map = {
    valid: "border-success/40 bg-success/10 text-success",
    used: "border-line bg-canvas-surface-2 text-ink-muted",
    expired: "border-danger/30 bg-danger/10 text-danger",
  } as const;
  const label = { valid: "Ativo", used: "Usado", expired: "Expirado" }[status];
  return <span className={`rounded-md border px-2 py-0.5 text-xs ${map[status]}`}>{label}</span>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function InviteManager({
  tenants,
  initialInvites,
  error,
}: {
  tenants: Array<{ slug: string; name: string }>;
  initialInvites: InviteRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<"new_tenant" | "add_user">("new_tenant");
  const [tenantSlug, setTenantSlug] = useState(tenants[0]?.slug ?? "");
  const [role, setRole] = useState("owner");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    setGenerated(null);
    try {
      const res = await fetch("/api/auth/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          tenant_slug: type === "add_user" ? tenantSlug : undefined,
          role: type === "add_user" ? role : "owner",
          email: email.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "não foi possível gerar");
      setGenerated({ url: data.url, expires_at: data.expires_at });
      setEmail("");
      setNote("");
      router.refresh();
    } catch (e2) {
      setFormErr(String(e2 instanceof Error ? e2.message : e2));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard bloqueado — usuário copia manualmente */
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Revogar este convite? O link deixará de funcionar.")) return;
    const res = await fetch(`/api/auth/invites/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Lista */}
      <section>
        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas-surface text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Convite</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expira</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {initialInvites.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                    Nenhum convite gerado ainda.
                  </td>
                </tr>
              )}
              {initialInvites.map((inv) => (
                <tr key={inv.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-ink">
                      {inv.type === "new_tenant" ? "Nova empresa" : `Acesso · ${inv.tenant?.name ?? "—"}`}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {inv.type === "add_user" ? `${inv.role}` : "responsável"}
                      {inv.email ? ` · ${inv.email}` : ""}
                      {inv.note ? ` · ${inv.note}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{fmtDate(inv.expires_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {inv.status !== "used" && (
                      <button
                        onClick={() => revoke(inv.id)}
                        title="Revogar"
                        className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-surface-2 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gerar */}
      <aside className="h-fit rounded-xl border border-line bg-canvas-surface p-5">
        <h2 className="font-serif text-lg text-ink">Gerar convite</h2>
        <p className="mt-1 text-xs text-ink-muted">
          O link vale por 2 dias e só pode ser usado uma vez.
        </p>

        <form onSubmit={generate} className="mt-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(["new_tenant", "add_user"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md border px-3 py-2 text-[13px] transition-colors ${
                  type === t
                    ? "border-line-strong bg-canvas-surface-2 text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {t === "new_tenant" ? "Nova empresa" : "Adicionar usuário"}
              </button>
            ))}
          </div>

          {type === "add_user" && (
            <>
              <label className="block">
                <span className={labelCls}>Empresa</span>
                <select value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className={inputCls} required>
                  {tenants.length === 0 && <option value="">— sem empresas —</option>}
                  {tenants.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Papel</span>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="block">
            <span className={labelCls}>Travar para um e-mail (opcional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="só este e-mail poderá usar"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Rótulo (opcional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
              placeholder="ex: Facilita — João"
            />
          </label>

          {formErr && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {formErr}
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Gerando…" : "Gerar link"}
          </Button>
        </form>

        {generated && (
          <div className="mt-5 rounded-lg border border-line bg-canvas-deep p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Link2 size={13} /> Link gerado · expira {fmtDate(generated.expires_at)}
            </div>
            <div className="mt-2 flex items-stretch gap-2">
              <input
                readOnly
                value={generated.url}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 py-2 text-[12px] text-ink-soft"
              />
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1 rounded-md border border-line px-2.5 text-[12px] text-ink-soft transition-colors hover:bg-canvas-surface-2"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              Envie este link para a pessoa. Por segurança, ele não aparece de novo depois de fechar.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
