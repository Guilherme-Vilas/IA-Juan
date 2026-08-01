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
  const [honeypot, setHoneypot] = useState("");

  const canNext =
    step === 0
      ? name.trim().length > 1 && email.includes("@")
      : step === 1
        ? !!sector && !!size
        : !!leads && !!response && !!challenge;

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
    return (
      <div className="animate-fade-up rounded-2xl border border-accent-bronze/30 bg-canvas-surface p-8 text-center shadow-elevated">
        <CheckCircle2 size={36} className="mx-auto mb-4 text-success" />
        <h2 className="font-serif text-2xl text-ink">Diagnóstico a caminho.</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft">
          Recebemos suas respostas, {name.split(" ")[0]}. Nossa equipe analisa o seu cenário e te
          retorna <strong className="text-ink">em até 1 dia útil</strong> — confirmação enviada pro
          seu e-mail.
        </p>
        <a
          href="/#demo"
          className="shine mt-6 inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse"
        >
          <Sparkles size={15} /> Enquanto espera: teste a IA ao vivo
        </a>
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
