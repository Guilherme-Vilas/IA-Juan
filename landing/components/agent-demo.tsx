"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Building2,
  Landmark,
  ShieldQuestion,
  RotateCcw,
  CheckCircle2,
  Zap,
  User,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { primaryCtaHref } from "@/lib/site";

// ============================================================================
// A demo que vende: o visitante conversa com a Stella REAL (esquerda) e vê,
// ao mesmo tempo, o painel que ELE teria como dono (direita) — ficha do lead
// preenchendo, score subindo, funil andando e a timeline narrando o trabalho.
// ============================================================================

type Scenario = "imovel" | "consorcio" | "cetico";
type Msg = { from: "me" | "stella"; text: string };
type Score = { score: number; label: string };
type TurnResponse = {
  sessionId?: string;
  opener?: string;
  replies: string[];
  state: string;
  slots: Record<string, unknown>;
  score: Score;
  suggestions: string[];
  remaining: number;
  done: boolean;
  captureEnabled?: boolean;
  error?: string;
};

// opener espelha OPENERS do backend (src/api/demo.ts) — usado pra entrada
// otimista: o chat abre na hora, com a mensagem do "cliente" já enviada.
const SCENARIOS: Array<{ id: Scenario; icon: typeof Building2; title: string; desc: string; opener: string }> = [
  {
    id: "imovel",
    icon: Building2,
    title: "Quero comprar um apartamento",
    desc: "Você é o cliente da imobiliária",
    opener: "Oi! Vi um apartamento de 2 quartos no anúncio de vocês. Ainda tá disponível?",
  },
  {
    id: "consorcio",
    icon: Landmark,
    title: "Quero investir em consórcio",
    desc: "Você é o lead do consultor",
    opener: "Oi! Quero entender como usar consórcio pra investir. Como funciona?",
  },
  {
    id: "cetico",
    icon: ShieldQuestion,
    title: "Sou cético, me convença",
    desc: "Jogue as objeções mais difíceis",
    opener: "Vou ser sincero: acho que robô no WhatsApp não convence cliente nenhum. Me prova o contrário?",
  },
];

// Telemetria do funil da demo — dispara no GA/Pixel quando configurados.
function track(event: string, params?: Record<string, unknown>) {
  try {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    w.gtag?.("event", event, params ?? {});
    w.fbq?.("trackCustom", event, params ?? {});
  } catch {
    /* analytics nunca quebra a demo */
  }
}

const SLOT_LABELS: Record<string, string> = {
  nome: "Nome",
  profissao: "Profissão",
  interesse: "Interesse",
  finalidade: "Finalidade",
  tipo_imovel: "Tipo de imóvel",
  regiao: "Região",
  renda_aproximada: "Renda",
  capacidade_mensal: "Parcela viável",
  valor_bem: "Valor do bem",
  entrada_disponivel: "Entrada",
  usa_fgts: "FGTS",
  intencao_lance: "Lance",
  prazo_decisao: "Timing",
  prazo_meses: "Prazo",
};

const STATE_STEP: Record<string, number> = {
  S0_ABERTURA: 0,
  S1_DESCOBERTA: 0,
  S2_QUALIFICACAO: 1,
  S3_EDUCACAO: 1,
  S4_AGENDAMENTO: 2,
  S5_CONFIRMADO: 3,
  HANDOFF: 3,
};

const STATE_DOING: Record<string, string> = {
  S0_ABERTURA: "Stella está acolhendo o lead…",
  S1_DESCOBERTA: "Stella está descobrindo o interesse…",
  S2_QUALIFICACAO: "Stella está qualificando…",
  S3_EDUCACAO: "Stella está tratando objeções…",
  S4_AGENDAMENTO: "Stella está propondo horários…",
  S5_CONFIRMADO: "Lead qualificado e agendado ✓",
  HANDOFF: "Lead entregue ao corretor ✓",
};

const SCORE_COLOR: Record<string, string> = {
  frio: "#71717A",
  morno: "#FBBF24",
  quente: "#FB923C",
  pronto: "#4ADE80",
};

function slotDisplay(v: unknown): string {
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

export function AgentDemo() {
  const [phase, setPhase] = useState<"pick" | "live">("pick");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState("S0_ABERTURA");
  const [slots, setSlots] = useState<Record<string, unknown>>({});
  const [score, setScore] = useState<Score>({ score: 0, label: "frio" });
  const [events, setEvents] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const prevSlots = useRef<Record<string, unknown>>({});
  const prevScore = useRef(0);
  // chips já enviados na sessão — nunca repetimos sugestão (evita "travar")
  const usedSuggestions = useRef<Set<string>>(new Set());

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  function pushEvents(next: TurnResponse) {
    const fresh: string[] = [];
    for (const [k, v] of Object.entries(next.slots ?? {})) {
      if (v != null && v !== "" && prevSlots.current[k] == null && SLOT_LABELS[k]) {
        fresh.push(`✓ ${SLOT_LABELS[k]} capturado: ${slotDisplay(v)}`);
      }
    }
    if (next.score.score > prevScore.current) {
      fresh.push(`⚡ Score subiu: ${prevScore.current}% → ${next.score.score}%`);
    }
    if (STATE_STEP[next.state] !== STATE_STEP[state]) {
      fresh.push(`→ ${STATE_DOING[next.state] ?? next.state}`);
    }
    prevSlots.current = next.slots ?? {};
    prevScore.current = next.score.score;
    if (fresh.length) setEvents((e) => [...e, ...fresh].slice(-8));
  }

  async function applyTurn(next: TurnResponse, opts: { quickFirst?: boolean } = {}) {
    setState(next.state);
    setSlots(next.slots ?? {});
    setScore(next.score);
    pushEvents(next);
    // ritmo humano: "digitando…" proporcional ao tamanho, pausa entre mensagens.
    // quickFirst: o visitante já esperou a rede — a 1ª bolha entra mais rápido.
    for (const [i, r] of next.replies.entries()) {
      setTyping(true);
      const base = i === 0 && opts.quickFirst ? 350 : 900;
      await new Promise((res) => setTimeout(res, Math.min(base + r.length * 28, 3200)));
      setTyping(false);
      setMsgs((m) => [...m, { from: "stella", text: r }]);
      if (i < next.replies.length - 1) await new Promise((res) => setTimeout(res, 700));
    }
    const fresh = (next.suggestions ?? []).filter((s) => !usedSuggestions.current.has(s)).slice(0, 3);
    setSuggestions(next.done ? [] : fresh);
    if (next.done) {
      setDone(true);
      track("demo_done", { score: next.score.score, estado: next.state });
    }
  }

  async function start(scenario: Scenario) {
    const sc = SCENARIOS.find((s) => s.id === scenario)!;
    setBusy(true);
    setNotice(null);
    // Entrada OTIMISTA: o chat abre na hora com a mensagem do "cliente" e o
    // digitando… — a espera da rede vira parte da experiência.
    setPhase("live");
    setMsgs([{ from: "me", text: sc.opener }]);
    setEvents(["● Novo lead entrou no funil"]);
    setTyping(true);
    prevSlots.current = {};
    prevScore.current = 0;
    track("demo_start", { cenario: scenario });
    try {
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = (await res.json()) as TurnResponse;
      if (!res.ok) throw new Error(data?.error ?? "erro ao iniciar");
      setSessionId(data.sessionId!);
      setCaptureEnabled(!!data.captureEnabled);
      await applyTurn(data, { quickFirst: true });
    } catch (err) {
      // falhou: volta pro seletor com o aviso (nada de chat morto)
      setTyping(false);
      setPhase("pick");
      setMsgs([]);
      setEvents([]);
      setNotice(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || typing || done || !sessionId) return;
    usedSuggestions.current.add(t);
    track("demo_message");
    setBusy(true);
    setNotice(null);
    setInput("");
    setSuggestions([]);
    setMsgs((m) => [...m, { from: "me", text: t }]);
    // "digitando…" já durante a espera da IA — silêncio parece travado
    const preTyping = setTimeout(() => setTyping(true), 500);
    try {
      const res = await fetch("/api/demo/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text: t }),
      });
      const data = (await res.json()) as TurnResponse;
      clearTimeout(preTyping);
      if (!res.ok) {
        setTyping(false);
        if ((data as { done?: boolean }).done) setDone(true);
        throw new Error(data?.error ?? "erro");
      }
      await applyTurn(data);
    } catch (err) {
      clearTimeout(preTyping);
      setTyping(false);
      setNotice(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("pick");
    setSessionId(null);
    setMsgs([]);
    setSuggestions([]);
    setSlots({});
    setScore({ score: 0, label: "frio" });
    setEvents([]);
    setState("S0_ABERTURA");
    setDone(false);
    setNotice(null);
    usedSuggestions.current = new Set();
  }

  const filledSlots = Object.entries(slots).filter(([k, v]) => v != null && v !== "" && SLOT_LABELS[k]);

  return (
    <section id="demo" className="border-y border-line bg-canvas-deep py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 flex items-center justify-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            <Sparkles size={13} /> Prove antes de acreditar
          </p>
          <h2 className="font-serif text-section-title text-ink">
            Não acredite na gente.{" "}
            <span className="italic text-accent-bronze-soft">Teste a Stella agora.</span>
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">
            À esquerda, você é o cliente. À direita, o painel que <strong className="text-ink">você</strong>{" "}
            teria como dono — vendo a IA trabalhar em tempo real.
          </p>
        </div>

        {/* Moldura de simulador — deixa EXPLÍCITO que aqui é teste ao vivo */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-accent-bronze/30 shadow-glow-bronze">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-bronze/20 bg-accent-bronze/10 px-5 py-3">
            <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-bronze-soft">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-danger opacity-60" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              Simulação ao vivo
            </span>
            <span className="text-[11.5px] text-ink-soft">
              Você fala com a <strong className="text-ink">IA de verdade</strong> — não é vídeo nem roteiro.
            </span>
          </div>

          <div className="bg-canvas p-5 md:p-8">
        {phase === "pick" ? (
          <div className="mx-auto max-w-3xl">
            {/* como funciona o teste, em 3 passos */}
            <div className="mb-8 grid gap-2 text-[12.5px] sm:grid-cols-3">
              {[
                "Escolha quem você quer ser",
                "Converse como um cliente de verdade",
                "Veja o painel do corretor reagir ao lado",
              ].map((s, i) => (
                <div key={s} className="flex items-center gap-2.5 rounded-lg bg-canvas-surface px-3.5 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent-bronze/40 bg-accent-bronze/10 font-serif text-[12px] text-accent-bronze-soft">
                    {i + 1}
                  </span>
                  <span className="text-ink-soft">{s}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {SCENARIOS.map(({ id, icon: Icon, title, desc }) => (
                <button
                  key={id}
                  disabled={busy}
                  onClick={() => start(id)}
                  className="group flex flex-col rounded-xl border border-line bg-canvas-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-bronze/40 hover:shadow-glow-bronze disabled:opacity-50"
                >
                  <Icon size={20} strokeWidth={1.75} className="mb-3 text-accent-bronze-soft" />
                  <h3 className="mb-1 font-serif text-[15px] text-ink">{title}</h3>
                  <p className="text-[12px] text-ink-muted">{desc}</p>
                  <span className="shine mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-bronze-metal px-3 py-2 text-[12px] font-semibold text-ink-inverse">
                    {busy ? "Chamando a Stella…" : "Iniciar teste"} <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
            {notice && <p className="mt-4 text-center text-[12px] text-warning">{notice}</p>}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            {/* ===== CHAT (visão do lead) ===== */}
            <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-line bg-canvas-surface shadow-elevated">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-accent-bronze/40 bg-accent-bronze/15 font-serif text-sm text-accent-bronze-soft">
                    S
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-medium text-ink">Stella</div>
                    <div className="flex items-center gap-1 text-[10px] text-success">
                      <span className="h-1 w-1 animate-pulse-soft rounded-full bg-success" /> online agora
                    </div>
                  </div>
                </div>
                <button onClick={reset} className="flex items-center gap-1 text-[11px] text-ink-faint transition-colors hover:text-ink">
                  <RotateCcw size={11} /> recomeçar
                </button>
              </div>

              {/* Barra CRM compacta — no mobile o painel fica abaixo da dobra;
                  aqui o visitante vê o score e a etapa sem sair do chat */}
              <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas-deep/70 px-4 py-2 lg:hidden">
                <span key={`${score.score}-${state}`} className="flex min-w-0 animate-fade-in items-center gap-2">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 font-serif text-[9.5px] text-ink"
                    style={{ borderColor: SCORE_COLOR[score.label] ?? "#B08D57" }}
                  >
                    {score.score}%
                  </span>
                  <span className="truncate text-[11px] text-ink-soft">
                    {typing ? "Stella trabalhando…" : STATE_DOING[state] ?? "Aguardando…"}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-ink-faint">painel completo ↓</span>
              </div>

              <div ref={chatRef} className="flex-1 space-y-2.5 overflow-y-auto p-4 text-[13.5px]">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex animate-fade-up ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={
                        m.from === "me"
                          ? "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-bronze/20 px-3.5 py-2 text-ink"
                          : "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3.5 py-2 text-ink-soft"
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex animate-fade-in justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3.5 py-2.5 text-ink-muted">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                {done && (
                  <div className="animate-fade-up rounded-xl border border-accent-bronze/30 bg-accent-bronze/10 p-4 text-center">
                    <p className="font-serif text-[15px] text-ink">
                      Isso acabou de acontecer com você. <span className="italic text-accent-bronze-soft">Imagina no seu WhatsApp.</span>
                    </p>
                    {captureEnabled && sessionId ? (
                      <CaptureForm sessionId={sessionId} />
                    ) : (
                      <a
                        href={primaryCtaHref()}
                        className="shine mt-3 inline-flex items-center gap-2 rounded-md bg-bronze-metal px-5 py-2.5 text-[13px] font-semibold text-ink-inverse"
                      >
                        Quero isso no meu negócio <ArrowRight size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* sugestões estilo Gemini + input */}
              <div className="border-t border-line p-3">
                {suggestions.length > 0 && !done && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        disabled={busy || typing}
                        className="animate-fade-in rounded-full border border-accent-bronze/30 bg-accent-bronze/[0.07] px-3 py-1.5 text-[12px] text-accent-bronze-soft transition-colors hover:bg-accent-bronze/15 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {notice && <p className="mb-2 text-[11px] text-warning">{notice}</p>}
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send(input)}
                    placeholder={done ? "Sessão de teste encerrada" : "Ou escreva do seu jeito…"}
                    disabled={busy || typing || done}
                    maxLength={300}
                    className="flex-1 rounded-full border border-line bg-canvas-deep px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={busy || typing || done || !input.trim()}
                    aria-label="Enviar"
                    className="grid h-10 w-10 place-items-center rounded-full bg-bronze-metal text-ink-inverse transition-transform hover:scale-105 disabled:opacity-40"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* ===== PAINEL DO CORRETOR (visão do dono) ===== */}
            <div className="flex h-[560px] flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-canvas p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                <Zap size={12} className="text-accent-bronze-soft" /> O que você veria como dono
              </div>

              {/* status + score */}
              <div className="flex items-center gap-4 rounded-lg border border-line bg-canvas-surface p-3.5">
                <ScoreRing value={score.score} label={score.label} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">
                    {typing ? "Stella está respondendo…" : STATE_DOING[state] ?? "Aguardando…"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Lead <span style={{ color: SCORE_COLOR[score.label] }}>{score.label}</span> · score{" "}
                    {score.score}%
                  </p>
                </div>
              </div>

              {/* funil */}
              <div className="rounded-lg border border-line bg-canvas-surface p-3.5">
                <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                  Etapa do funil
                </p>
                <div className="flex items-center gap-1">
                  {["Novo", "Qualificando", "Agendamento", "Fechado"].map((s, i) => {
                    const cur = STATE_STEP[state] ?? 0;
                    const active = i === cur;
                    const passed = i < cur;
                    return (
                      <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className={`h-1.5 w-full rounded-full transition-colors duration-500 ${
                            active ? "bg-accent-bronze" : passed ? "bg-accent-bronze/40" : "bg-canvas-surface-2"
                          }`}
                        />
                        <span className={`text-[9.5px] ${active ? "text-accent-bronze-soft" : "text-ink-faint"}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ficha do lead */}
              <div className="rounded-lg border border-line bg-canvas-surface p-3.5">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                  <User size={11} /> Ficha do lead (montada pela IA)
                </p>
                {filledSlots.length === 0 ? (
                  <p className="py-2 text-center text-[11.5px] text-ink-faint">
                    A ficha vai preenchendo conforme a conversa…
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filledSlots.map(([k, v]) => (
                      <div key={k} className="flex animate-fade-up items-center justify-between gap-2 text-[12px]">
                        <span className="text-ink-muted">{SLOT_LABELS[k]}</span>
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          {slotDisplay(v)} <CheckCircle2 size={11} className="text-success" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* timeline */}
              <div className="flex-1 rounded-lg border border-line bg-canvas-surface p-3.5">
                <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                  Linha do tempo
                </p>
                <div className="space-y-1.5">
                  {events.map((e, i) => (
                    <p key={i} className="animate-fade-up text-[11.5px] leading-relaxed text-ink-soft">
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Anel de score animado (SVG) — transição suave conforme o score sobe.
function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = SCORE_COLOR[label] ?? "#B08D57";
  return (
    <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
      <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#1C1C21" strokeWidth="5" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1), stroke 0.4s" }}
        />
      </svg>
      <span className="absolute font-serif text-[15px] text-ink">{value}%</span>
    </div>
  );
}

// Captura suave: o visitante impressionado vira lead da Vita OS.
function CaptureForm({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/demo/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro");
      setSent(true);
      track("demo_capture");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-success">
        <MessageCircle size={14} /> Fechou! A gente te chama no WhatsApp. 👊
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-ink-muted">Quer isso no seu negócio? Deixa seu WhatsApp que a gente te chama:</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="flex-1 rounded-md border border-line bg-canvas-deep px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp com DDD"
          inputMode="tel"
          className="flex-1 rounded-md border border-line bg-canvas-deep px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy || phone.replace(/\D/g, "").length < 10}
          className="shine rounded-md bg-bronze-metal px-4 py-2 text-[13px] font-semibold text-ink-inverse disabled:opacity-40"
        >
          {busy ? "Enviando…" : "Me chama"}
        </button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}
    </div>
  );
}
