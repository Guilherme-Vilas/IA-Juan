"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, X, Send, Sparkles, Zap, Check, ChevronDown } from "lucide-react";

// Assistente de suporte in-app: responde, consulta dados reais e PROPÕE ações
// que só executam com confirmação humana (card Aplicar/Descartar).

type ActionState = "pending" | "applying" | "applied" | "rejected" | "error";
type ActionCard = {
  id: number;
  type: string;
  summary: string;
  detail: string | null;
  state: ActionState;
  error?: string;
};
type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "action"; action: ActionCard };

const ACTION_LABEL: Record<string, string> = {
  editar_prompt: "Editar prompt da IA",
  pausar_campanha: "Pausar campanha",
  retomar_campanha: "Retomar campanha",
  limite_envio: "Limite de envio",
  bloquear_numero: "Bloquear número",
};

const SUGGESTIONS = [
  "Por que minha campanha enviou pouco?",
  "Meu WhatsApp está conectado?",
  "Faça a IA nunca falar valores de parcela",
  "Como assumo uma conversa da IA?",
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
      // só user/assistant vão pro histórico do modelo (cards ficam locais)
      const history = next.filter((m): m is { role: "user" | "assistant"; content: string } => m.role !== "action");
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : (data?.error ?? "não consegui responder agora — tenta de novo?");
      const actions: ActionCard[] = (data?.actions ?? []).map(
        (a: { id: number; type: string; summary: string; detail: string | null }) => ({ ...a, state: "pending" as const }),
      );
      setMsgs((m) => [...m, { role: "assistant", content: reply }, ...actions.map((a) => ({ role: "action" as const, action: a }))]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Conexão falhou — tenta de novo em instantes." }]);
    } finally {
      setBusy(false);
    }
  };

  const patchAction = (id: number, patch: Partial<ActionCard>) => {
    setMsgs((m) =>
      m.map((x) => (x.role === "action" && x.action.id === id ? { role: "action", action: { ...x.action, ...patch } } : x)),
    );
  };

  const resolveAction = async (a: ActionCard, verb: "apply" | "reject") => {
    patchAction(a.id, { state: "applying", error: undefined });
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/assistant/actions/${a.id}/${verb}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "erro");
      patchAction(a.id, { state: verb === "apply" ? "applied" : "rejected" });
    } catch (e) {
      patchAction(a.id, { state: "error", error: String(e instanceof Error ? e.message : e) });
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
            {msgs.map((m, i) =>
              m.role === "action" ? (
                <div key={i} className="animate-fade-up rounded-xl border border-accent-bronze/40 bg-accent-bronze/[0.07] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Zap size={11} className="text-accent-bronze-soft" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-bronze-soft">
                      {ACTION_LABEL[m.action.type] ?? m.action.type}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink">{m.action.summary}</p>
                  {m.action.detail && (
                    <details className="group mt-1.5">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                        Ver detalhes <ChevronDown size={10} className="transition-transform group-open:rotate-180" />
                      </summary>
                      <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-canvas-deep p-2.5 font-mono text-[10.5px] leading-relaxed text-ink-soft">
                        {m.action.detail}
                      </pre>
                    </details>
                  )}
                  <div className="mt-2.5">
                    {m.action.state === "pending" || m.action.state === "error" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resolveAction(m.action, "apply")}
                          className="shine inline-flex items-center gap-1.5 rounded-md bg-bronze-metal px-3.5 py-1.5 text-[12px] font-semibold text-ink-inverse"
                        >
                          <Check size={12} /> Aplicar
                        </button>
                        <button
                          onClick={() => resolveAction(m.action, "reject")}
                          className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink"
                        >
                          Descartar
                        </button>
                      </div>
                    ) : m.action.state === "applying" ? (
                      <span className="text-[11.5px] text-ink-muted">Aplicando…</span>
                    ) : m.action.state === "applied" ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-success">
                        <Check size={12} /> Aplicado — já está valendo
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-ink-faint">Descartado</span>
                    )}
                    {m.action.error && <p className="mt-1 text-[11px] text-danger">{m.action.error}</p>}
                  </div>
                </div>
              ) : (
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
              ),
            )}
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
