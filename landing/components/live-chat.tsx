"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, MessageSquare } from "lucide-react";

// Conversa que ACONTECE na frente do visitante — bolhas entram em sequência,
// com "digitando…" antes de cada resposta da IA. Ver é crer.

type Msg = { side: "in" | "out"; text: string };

const SCRIPT: Msg[] = [
  { side: "in", text: "Oi, vi o apartamento de 2 quartos no anúncio. Ainda tá disponível?" },
  { side: "out", text: "Oi! Tá sim 🙌 Pra eu te direcionar certo: vai ser pra morar ou investir?" },
  { side: "in", text: "Pra morar. Tenho uns 50 mil de entrada" },
  { side: "out", text: "Perfeito! Com essa entrada e uso do FGTS já abre um bom leque por ali." },
  { side: "out", text: "Quer ver o apê pessoalmente? Tenho amanhã 18h30 ou quinta 10h." },
  { side: "in", text: "Quinta 10h fica ótimo" },
];

export function LiveChat() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      await sleep(900);
      for (let i = 0; i < SCRIPT.length; i++) {
        if (cancelled) return;
        const msg = SCRIPT[i]!;
        if (msg.side === "out") {
          setTyping(true);
          await sleep(1100);
          setTyping(false);
        } else {
          await sleep(i === 0 ? 0 : 1400);
        }
        if (cancelled) return;
        setVisible(i + 1);
      }
      await sleep(700);
      if (!cancelled) setDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visible, typing, done]);

  return (
    <div className="rounded-xl border border-line bg-canvas-surface bg-sheen p-4 text-left shadow-elevated">
      <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
        <span className="flex items-center gap-2 text-[12px] text-ink-muted">
          <MessageSquare size={15} className="text-accent-bronze" /> Conversa real da IA · agora
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-success">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-success" /> online
        </span>
      </div>

      <div ref={scrollRef} className="h-[240px] space-y-2.5 overflow-y-auto pr-1 text-[13px]">
        {SCRIPT.slice(0, visible).map((m, i) => (
          <div key={i} className={`flex animate-fade-up ${m.side === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.side === "out"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-accent-bronze/20 px-3 py-2 text-ink"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3 py-2 text-ink-soft"
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex animate-fade-in justify-end">
            <div className="flex items-center gap-1 rounded-2xl rounded-br-sm bg-accent-bronze/20 px-3.5 py-2.5 text-accent-bronze-soft">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        {done && (
          <div className="animate-fade-up pt-1">
            <div className="flex items-center gap-2 rounded-md bg-accent-bronze/10 px-3 py-2 text-[12px] text-accent-bronze-soft">
              <CalendarCheck size={14} /> Visita agendada pra quinta 10h · lead completo enviado ao corretor
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
