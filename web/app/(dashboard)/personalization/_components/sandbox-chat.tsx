"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, RotateCcw, Send } from "lucide-react";
import { STATE_LABELS, type LeadState } from "@/lib/types";
import { toastError } from "@/lib/toast";

// Testar a IA sem WhatsApp: conversa sandbox que roda o MESMO motor de produção
// (prompt salvo, qualificação, agendamento simulado). Nada chega a leads reais,
// ao funil ou ao dono. Fluxo: edita o prompt → Salvar → testa aqui → publica.

type Msg = { role: "user" | "assistant"; content: string };

export function SandboxChat({ tenantSlug }: { tenantSlug: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, unknown>>({});
  const [showSlots, setShowSlots] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const base = `/api/admin-proxy/tenants/${tenantSlug}/sandbox`;

  useEffect(() => {
    fetch(base, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { lead?: { state: string; slots: Record<string, unknown> } | null; messages?: Msg[] }) => {
        if (d.messages?.length) setMessages(d.messages.filter((m) => m.role === "user" || m.role === "assistant"));
        if (d.lead) {
          setState(d.lead.state);
          setSlots(d.lead.slots ?? {});
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch(`${base}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reply?: string | null;
        state?: string;
        slots?: Record<string, unknown>;
        handoff?: boolean;
        closed_reason?: string | null;
      };
      if (!res.ok) throw new Error(data.error || "falha no teste");
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "((a IA não respondeu este turno — veja o estado abaixo))" },
        ]);
      }
      if (data.state) setState(data.state);
      if (data.slots) setSlots(data.slots);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Falha no teste — tente de novo.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (messages.length && !confirm("Recomeçar a conversa de teste do zero?")) return;
    setBusy(true);
    try {
      await fetch(`${base}/reset`, { method: "POST" });
      setMessages([]);
      setState(null);
      setSlots({});
    } finally {
      setBusy(false);
    }
  }

  const filledSlots = Object.entries(slots).filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div className="flex h-[560px] flex-col rounded-xl border border-accent-bronze/30 bg-canvas-surface/60 shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-accent-bronze-soft" />
          <div>
            <div className="text-sm font-semibold text-ink">Testar a IA</div>
            <div className="text-[10px] text-ink-faint">simulação real · nada sai pro WhatsApp</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <span className="rounded-full border border-line bg-canvas-deep px-2 py-0.5 text-[10px] text-ink-soft">
              {STATE_LABELS[state as LeadState] ?? state}
            </span>
          )}
          <button
            onClick={reset}
            disabled={busy}
            title="Recomeçar conversa"
            aria-label="Recomeçar conversa de teste"
            className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-surface-2 hover:text-ink disabled:opacity-50"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center px-6 text-center text-xs text-ink-muted">
            <p>
              Converse como se fosse um lead.
              <br />
              <span className="text-ink-faint">Dica: salve o prompt antes — o teste usa o que está salvo.</span>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                m.role === "user"
                  ? "rounded-br-sm bg-accent-bronze/20 text-ink"
                  : "rounded-bl-sm border border-line bg-canvas-deep text-ink-soft"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-line bg-canvas-deep px-3 py-2 text-[13px] text-ink-faint">
              digitando…
            </div>
          </div>
        )}
      </div>

      {filledSlots.length > 0 && (
        <div className="border-t border-line px-3 py-1.5">
          <button
            onClick={() => setShowSlots((v) => !v)}
            className="text-[10px] uppercase tracking-wide text-ink-faint hover:text-ink-soft"
            aria-expanded={showSlots}
          >
            {showSlots ? "▾" : "▸"} dados capturados ({filledSlots.length})
          </button>
          {showSlots && (
            <div className="mt-1 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
              {filledSlots.map(([k, v]) => (
                <span key={k} className="rounded bg-canvas-deep px-1.5 py-0.5 text-[10px] text-ink-soft">
                  {k}: <span className="text-ink">{String(v)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Escreva como o lead escreveria…"
          aria-label="Mensagem de teste"
          disabled={busy}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-canvas-deep px-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Enviar mensagem de teste"
          className="grid h-9 w-9 place-items-center rounded-md bg-bronze-metal text-ink-inverse disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
