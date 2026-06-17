"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full rounded-md border border-line bg-canvas-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "sdr", label: "SDR" },
  { value: "viewer", label: "Viewer" },
];

export function CreateUserForm({ tenants }: { tenants: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [tenantSlug, setTenantSlug] = useState(tenants[0]?.slug ?? "");
  const [role, setRole] = useState("owner");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          is_superadmin: isSuperadmin,
          tenant_slug: isSuperadmin ? undefined : tenantSlug || undefined,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "não foi possível criar");
      setMsg({ kind: "ok", text: `Usuário ${data.user.email} criado.` });
      setName("");
      setEmail("");
      setPassword("");
      setIsSuperadmin(false);
      router.refresh();
    } catch (e2) {
      setMsg({ kind: "err", text: String(e2 instanceof Error ? e2.message : e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="h-fit rounded-xl border border-line bg-canvas-surface p-5">
      <h2 className="font-serif text-lg text-ink">Novo usuário</h2>
      <p className="mt-1 text-xs text-ink-muted">
        O usuário verá apenas o tenant vinculado. Superadmin vê todos.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nome completo" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="usuario@empresa.com"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Senha</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="defina uma senha"
            required
          />
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={isSuperadmin}
            onChange={(e) => setIsSuperadmin(e.target.checked)}
            className="h-4 w-4 rounded border-line bg-canvas-deep accent-accent-bronze"
          />
          <span className="text-sm text-ink-soft">Superadmin (acesso a todos os tenants)</span>
        </label>

        {!isSuperadmin && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Tenant</span>
              <select value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className={inputCls} required>
                {tenants.length === 0 && <option value="">— sem tenants —</option>}
                {tenants.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Papel no tenant</span>
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

        {msg && (
          <div
            className={
              msg.kind === "ok"
                ? "rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success"
                : "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger"
            }
          >
            {msg.text}
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Criando…" : "Criar usuário"}
        </Button>
      </form>
    </aside>
  );
}
