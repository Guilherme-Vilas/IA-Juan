"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

// Diagnóstico Comercial Gratuito — formulário em 3 etapas que qualifica o
// interessado e alimenta: pipeline comercial + base de e-mail + notificação
// pra equipe com as respostas completas.

const SECTORS = ["Imobiliária", "Consórcio", "Crédito / Financiamento", "Seguros", "Outro"];
const SIZES = ["Só eu", "2 a 5 pessoas", "6 a 15 pessoas", "Mais de 15"];
const LEADS = ["Até 50/mês", "50 a 200/mês", "200 a 1.000/mês", "Mais de 1.000/mês", "Não sei dizer"];
const RESPONSE = ["Em minutos", "Em algumas horas", "No dia seguinte", "Depende / não sei"];
const CHALLENGES = [
  "Demoro pra responder os leads",
  "Recebo poucos leads",
  "Os leads que chegam são ruins",
  "Falta follow-up (esqueço de cobrar)",
  "Falta organização / CRM",
];
const TICKETS = ["Até R$ 5 mil", "R$ 5 a 15 mil", "R$ 15 a 40 mil", "Acima de R$ 40 mil", "Prefiro não dizer"];

// ===== Prévia consultiva: estimativa conservadora calculada das respostas =====
const LEADS_MID: Record<string, number> = {
  "Até 50/mês": 30,
  "50 a 200/mês": 120,
  "200 a 1.000/mês": 500,
  "Mais de 1.000/mês": 1500,
  "Não sei dizer": 80,
};
const LOSS_FACTOR: Record<string, number> = {
  "Em minutos": 0.12,
  "Em algumas horas": 0.38,
  "No dia seguinte": 0.55,
  "Depende / não sei": 0.45,
};
const TICKET_MID: Record<string, number | null> = {
  "Até R$ 5 mil": 3500,
  "R$ 5 a 15 mil": 10000,
  "R$ 15 a 40 mil": 25000,
  "Acima de R$ 40 mil": 60000,
  "Prefiro não dizer": null,
};
const CHALLENGE_INSIGHT: Record<string, string> = {
  "Demoro pra responder os leads":
    "A chance de contato despenca a cada hora sem resposta. Resposta em segundos, 24/7, é exatamente o vazamento nº 1 que dá pra estancar primeiro.",
  "Recebo poucos leads":
    "Volume não precisa depender de indicação: prospecção ativa em cadência + busca de leads por CNPJ criam fluxo previsível de conversas novas.",
  "Os leads que chegam são ruins":
    "O problema raro é o lead — é o filtro. Qualificação automática (renda, timing, decisor) separa curioso de comprador antes de chegar em você.",
  "Falta follow-up (esqueço de cobrar)":
    "Nos benchmarks de vendas, 40-60% das respostas vêm do follow-up — que é justamente o que escapa quando depende de memória humana.",
  "Falta organização / CRM":
    "Sem funil visível, lead esfria em silêncio. Um pipeline que se atualiza sozinho mostra exatamente onde está o dinheiro parado.",
};

function computePreview(leads: string, response: string, ticket: string) {
  const mid = LEADS_MID[leads] ?? 80;
  const factor = LOSS_FACTOR[response] ?? 0.4;
  const lostLeads = Math.max(1, Math.round(mid * factor));
  const tMid = TICKET_MID[ticket] ?? null;
  // conversão conservadora de 4% dos leads perdidos em vendas que não aconteceram
  const lostMoney = tMid ? Math.round((lostLeads * 0.04 * tMid) / 500) * 500 : null;
  return { lostLeads, lostMoney };
}

const inputClass =
  "w-full rounded-md border border-line bg-canvas-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none";

function OptionGrid({
  options,
  value,
  onPick,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={`rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-all ${
            value === o
              ? "border-accent-bronze/60 bg-accent-bronze/10 text-ink shadow-glow-bronze"
              : "border-line bg-canvas-surface text-ink-soft hover:border-accent-bronze/30"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function DiagnosticoForm() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [size, setSize] = useState("");
  const [leads, setLeads] = useState("");
  const [response, setResponse] = useState("");
  const [challenge, setChallenge] = useState("");
  const [ticket, setTicket] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const canNext =
    step === 0
      ? name.trim().length > 1 && email.includes("@")
      : step === 1
        ? !!sector && !!size
        : !!leads && !!response && !!challenge && !!ticket;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          sector,
          company_size: size,
          leads_per_month: leads,
          response_time: response,
          main_challenge: challenge,
          avg_ticket: ticket,
          website: honeypot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao enviar");
      setDone(true);
      try {
        (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "diagnostico_submit", { setor: sector });
        (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("trackCustom", "diagnostico_submit");
      } catch {
        /* analytics nunca quebra */
      }
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const { lostLeads, lostMoney } = computePreview(leads, response, ticket);
    return (
      <div className="animate-fade-up space-y-4">
        {/* Prévia consultiva imediata — devolve valor na hora */}
        <div className="rounded-2xl border border-accent-bronze/40 bg-canvas-surface bg-sheen p-8 shadow-glow-bronze">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-bronze-soft">
            <Sparkles size={12} /> Prévia do seu diagnóstico
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-canvas-deep/70 p-5 text-center">
              <div className="font-serif text-[40px] leading-none text-ink">~{lostLeads}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                leads/mês provavelmente <strong className="text-ink">escapando</strong> pelo tempo de
                resposta atual
              </p>
            </div>
            <div className="rounded-xl border border-accent-bronze/30 bg-accent-bronze/10 p-5 text-center">
              {lostMoney ? (
                <>
                  <div className="font-serif text-[32px] leading-tight text-accent-bronze-soft">
                    ≈ R$ {lostMoney.toLocaleString("pt-BR")}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                    por mês em comissões que <strong className="text-ink">não aconteceram</strong>
                  </p>
                </>
              ) : (
                <>
                  <div className="font-serif text-[28px] leading-tight text-accent-bronze-soft">R$ ?</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                    sem o valor da sua venda média, o custo fica pro raio-X completo
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="mt-5 rounded-lg border-l-2 border-accent-bronze/60 bg-canvas-deep/50 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              <strong className="text-ink">Sobre o seu maior gargalo:</strong>{" "}
              {CHALLENGE_INSIGHT[challenge] ?? ""}
            </p>
          </div>
          <p className="mt-4 text-[10.5px] leading-relaxed text-ink-faint">
            Estimativa conservadora com base em benchmarks de tempo de resposta e conversão média de 4%.
            O raio-X completo refina esses números com o seu cenário real.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-canvas-surface p-6 text-center">
          <CheckCircle2 size={26} className="mx-auto mb-3 text-success" />
          <p className="mx-auto max-w-md text-[13.5px] leading-relaxed text-ink-soft">
            {name.split(" ")[0]}, o <strong className="text-ink">raio-X completo</strong> (vazamentos,
            custo real e plano de ação em 3 passos) chega no seu e-mail{" "}
            <strong className="text-ink">em até 1 dia útil</strong> — análise feita por gente, não por
            robô.
          </p>
          <a
            href="/#demo"
            className="shine mt-5 inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse"
          >
            <Sparkles size={15} /> Enquanto espera: veja a IA estancar isso ao vivo
          </a>
        </div>
      </div>
    );
  }

  const steps = ["Sobre você", "Sua empresa", "Seu comercial hoje"];

  return (
    <div className="rounded-2xl border border-line bg-canvas-surface bg-sheen p-6 shadow-elevated md:p-8">
      {/* progresso */}
      <div className="mb-7 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div
              className={`h-1 rounded-full transition-colors duration-500 ${
                i <= step ? "bg-accent-bronze" : "bg-canvas-surface-2"
              }`}
            />
            <span className={`text-[10px] ${i === step ? "text-accent-bronze-soft" : "text-ink-faint"}`}>
              {i + 1}. {s}
            </span>
          </div>
        ))}
      </div>

      {/* honeypot invisível anti-bot */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />

      {step === 0 && (
        <div className="animate-fade-up space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Seu nome *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Como podemos te chamar?" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Seu e-mail *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="voce@empresa.com.br" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">WhatsApp (opcional — pra falar direto)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} placeholder="(41) 99999-8888" />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="animate-fade-up space-y-5">
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">Qual o seu setor? *</span>
            <OptionGrid options={SECTORS} value={sector} onPick={setSector} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">Tamanho da equipe comercial *</span>
            <OptionGrid options={SIZES} value={size} onPick={setSize} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-up space-y-5">
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">Quantos leads chegam por mês? *</span>
            <OptionGrid options={LEADS} value={leads} onPick={setLeads} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">Hoje, um lead novo é respondido… *</span>
            <OptionGrid options={RESPONSE} value={response} onPick={setResponse} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">Qual o maior gargalo? *</span>
            <OptionGrid options={CHALLENGES} value={challenge} onPick={setChallenge} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-ink-soft">
              Quanto vale uma venda fechada pra você (comissão)? *
            </span>
            <OptionGrid options={TICKETS} value={ticket} onPick={setTicket} />
          </div>
        </div>
      )}

      {err && <p className="mt-4 text-[12px] text-danger">{err}</p>}

      <div className="mt-7 flex items-center justify-between">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition-colors hover:text-ink"
          >
            <ArrowLeft size={13} /> Voltar
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button
            onClick={() => canNext && setStep((s) => s + 1)}
            disabled={!canNext}
            className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-2.5 text-sm font-semibold text-ink-inverse disabled:opacity-40"
          >
            Continuar <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canNext || busy}
            className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-2.5 text-sm font-semibold text-ink-inverse disabled:opacity-40"
          >
            {busy ? "Enviando…" : "Receber meu diagnóstico"} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
