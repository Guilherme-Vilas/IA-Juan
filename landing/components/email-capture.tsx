"use client";

import { useState } from "react";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

// Faixa de captura de e-mail — alimenta a base de marketing da Vita OS.
export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes("@") || state === "busy") return;
    setState("busy");
    setErr(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing-footer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao inscrever");
      setState("done");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setState("idle");
    }
  };

  return (
    <section className="border-t border-line bg-canvas-deep">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-12 md:flex-row">
        <div className="max-w-md text-center md:text-left">
          <h3 className="font-serif text-xl text-ink">
            Vendas com IA, <span className="italic text-accent-bronze-soft">sem enrolação</span>.
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            Táticas de atendimento e prospecção que funcionam no WhatsApp — direto no seu e-mail, sem spam.
            Descadastre quando quiser.
          </p>
        </div>

        {state === "done" ? (
          <p className="flex items-center gap-2 text-[14px] text-success">
            <CheckCircle2 size={16} /> Fechou! Fica de olho na caixa de entrada.
          </p>
        ) : (
          <div className="w-full max-w-sm">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="seu melhor e-mail"
                  className="w-full rounded-md border border-line bg-canvas-surface py-3 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none"
                />
              </div>
              <button
                onClick={submit}
                disabled={state === "busy" || !email.includes("@")}
                className="shine inline-flex items-center gap-1.5 rounded-md bg-bronze-metal px-5 text-[13px] font-semibold text-ink-inverse disabled:opacity-40"
              >
                {state === "busy" ? "…" : "Quero"} <ArrowRight size={13} />
              </button>
            </div>
            {err && <p className="mt-2 text-[11px] text-warning">{err}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
