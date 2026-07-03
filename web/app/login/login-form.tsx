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

  const inputClass =
    "w-full rounded-md border border-line bg-canvas-deep/80 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint " +
    "transition-all duration-200 focus:border-accent-bronze/50 focus:outline-none " +
    "focus:ring-2 focus:ring-accent-bronze/15 focus:shadow-[0_0_20px_-6px_rgba(176,141,87,0.35)]";

  return (
    <div className="stagger relative z-10 w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark className="brand-halo mb-5 h-14 w-14 border border-accent-bronze/30" />
        <h1 className="font-serif text-[28px] tracking-tight text-ink">Vita OS</h1>
        <p className="mt-1.5 font-serif text-[14px] italic text-accent-bronze-soft">
          Seu melhor vendedor, trabalhando 24 horas.
        </p>
      </div>

      {/* card de vidro com borda-gradiente (luz entrando por cima) */}
      <div className="rounded-2xl bg-gradient-to-b from-accent-bronze/25 via-line to-transparent p-px shadow-elevated">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-[19px] bg-canvas-surface/85 p-6 backdrop-blur-xl"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className={inputClass}
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
              className={inputClass}
              placeholder="••••••••"
              required
            />
          </label>

          {err && (
            <div className="animate-shake rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {err}
            </div>
          )}

          <Button type="submit" variant="bronze" disabled={busy} className="w-full" size="lg">
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-inverse/30 border-t-ink-inverse" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] tracking-wide text-ink-faint">
        Acesso restrito · <span className="text-accent-bronze/70">Vita OS</span> · systemvita.com.br
      </p>
    </div>
  );
}
