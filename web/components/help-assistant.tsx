"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, X, Send, Sparkles } from "lucide-react";

// Assistente de suporte in-app: tira dúvidas de uso e direciona pro lugar
// certo — reduz suporte humano. (Fase 1: responde; próximas: consulta e executa.)

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como mudo o comportamento da IA?",
  "Por que minha campanha enviou pouco?",
  "Como assumo uma conversa da IA?",
  "Como importo uma lista de leads?",
];

export function HelpAssistant({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : (data?.error ?? "não consegui responder agora — tenta de novo?");
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Conexão falhou — tenta de novo em instantes." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ajuda"
        className={`fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border transition-all duration-200 ${
          open
            ? "border-line bg-canvas-surface text-ink"
            : "border-accent-bronze/40 bg-bronze-metal text-ink-inverse shadow-glow-bronze hover:scale-105"
        }`}
      >
        {open ? <X size={20} /> : <HelpCircle size={22} />}
      </button>

      {/* painel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[520px] w-[360px] animate-scale-in flex-col overflow-hidden rounded-2xl border border-line bg-canvas-surface shadow-elevated">
          <div className="flex items-center gap-2.5 border-b border-line bg-canvas-deep/60 px-4 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-full border border-accent-bronze/40 bg-accent-bronze/15">
              <Sparkles size={14} className="text-accent-bronze-soft" />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-medium text-ink">Assistente Vita OS</p>
              <p className="text-[10.5px] text-ink-muted">Tira-dúvidas da plataforma</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3.5 text-[13px]">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  Oi! Pergunta qualquer coisa sobre a plataforma — eu te digo onde fica e como fazer.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-accent-bronze/25 bg-accent-bronze/[0.06] px-3 py-2 text-left text-[12px] text-accent-bronze-soft transition-colors hover:bg-accent-bronze/15"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-bronze/20 px-3 py-2 text-ink"
                      : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3 py-2 text-ink-soft"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3.5 py-2.5 text-ink-muted">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Sua dúvida…"
                maxLength={500}
                className="flex-1 rounded-full border border-line bg-canvas-deep px-4 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                aria-label="Enviar"
                className="grid h-9 w-9 place-items-center rounded-full bg-bronze-metal text-ink-inverse disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
