"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "não foi possível entrar");
      router.replace("/leads");
      router.refresh();
    } catch (e2) {
      setErr(String(e2 instanceof Error ? e2.message : e2));
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark className="mb-4 h-12 w-12 border border-line" />
        <h1 className="font-serif text-2xl text-ink">Vita OS</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Entre na sua conta</p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-xl border border-line bg-canvas-surface p-6 shadow-elevated"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-line bg-canvas-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20"
            placeholder="voce@empresa.com"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-line bg-canvas-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20"
            placeholder="••••••••"
            required
          />
        </label>

        {err && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {err}
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[11px] text-ink-faint">
        Acesso restrito · Vita OS · systemvita.com.br
      </p>
    </div>
  );
}
