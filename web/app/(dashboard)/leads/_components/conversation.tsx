"use client";

import { useEffect, useRef, useState } from "react";
import type { Lead, Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, AlertCircle } from "lucide-react";

export function Conversation({
  lead,
  messages,
  onSent,
}: {
  lead: Lead;
  messages: Message[];
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`/api/leads/${lead.wa_id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", text }),
      });
      if (!r.ok) {
        const e = await r.text();
        alert(`Falha ao enviar: ${e}`);
        return;
      }
      setText("");
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="grid h-24 place-items-center text-xs text-ink-muted">
            Sem mensagens ainda
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
      </div>

      <div className="border-t border-line pb-4 pt-3">
        {!lead.paused && (
          <div className="mb-2 flex items-center gap-1 text-xs text-warning">
            <AlertCircle size={12} />
            Enviar manualmente pausa a IA automaticamente.
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite e envie como Juan (takeover)…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
          />
          <Button onClick={send} disabled={!text.trim() || sending} size="md">
            <Send size={14} />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isOut = m.direction === "out";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
          isOut ? "bg-accent-bronze text-white" : "bg-canvas-surface border border-line text-ink"
        }`}
      >
        <div className="whitespace-pre-wrap">{m.content}</div>
        <div className={`mt-1 text-[10px] ${isOut ? "text-white/60" : "text-ink-muted"}`}>
          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
