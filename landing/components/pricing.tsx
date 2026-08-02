import { Check, Sparkles } from "lucide-react";
import { primaryCtaHref } from "@/lib/site";

// Preço público = confiança. Página sem preço, pro cético, cheira a enrolação.
const PLANS = [
  {
    name: "Essencial",
    price: 397,
    tagline: "Pro corretor que atende sozinho",
    highlight: false,
    features: [
      "1 número de WhatsApp com IA",
      "Atende, qualifica e agenda 24/7",
      "Pipeline, agenda e inbox",
      "2 usuários",
      "Academy de treinamentos",
    ],
  },
  {
    name: "Profissional",
    price: 697,
    tagline: "Pra equipe que quer escalar",
    highlight: true,
    features: [
      "Tudo do Essencial",
      "Prospecção ativa (cadências + A/B)",
      "Busca de leads por CNPJ",
      "Automações e importador universal",
      "5 usuários · suporte via WhatsApp",
    ],
  },
  {
    name: "Escala",
    price: 1297,
    tagline: "Pra imobiliária multi-equipe",
    highlight: false,
    features: [
      "Tudo do Profissional",
      "3 números de WhatsApp",
      "Usuários ilimitados",
      "Onboarding dedicado",
      "Suporte prioritário",
    ],
  },
];

export function Pricing() {
  return (
    <section id="planos" className="border-y border-line bg-canvas-deep py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            Preço transparente
          </p>
          <h2 className="font-serif text-section-title text-ink">
            Menos que <span className="italic text-accent-bronze-soft">um quinto</span> de um SDR contratado.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
            Um pré-vendedor CLT custa R$ 3.500+/mês e trabalha 8 horas. A Vita OS trabalha 24 — e uma
            única venda paga o ano inteiro.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                p.highlight
                  ? "border-accent-bronze/50 bg-canvas-surface shadow-glow-bronze"
                  : "border-line bg-canvas-surface/60"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent-bronze/50 bg-canvas px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-bronze-soft">
                  Mais escolhido
                </span>
              )}
              <h3 className="font-serif text-xl text-ink">{p.name}</h3>
              <p className="mt-1 text-[12px] text-ink-muted">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-[13px] text-ink-muted">R$</span>
                <span className="font-serif text-[42px] leading-none text-ink">{p.price}</span>
                <span className="text-[13px] text-ink-muted">/mês</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <Check size={14} className="mt-0.5 shrink-0 text-accent-bronze-soft" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href={primaryCtaHref()}
                className={
                  p.highlight
                    ? "shine mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-bronze-metal px-5 py-3 text-sm font-semibold text-ink-inverse"
                    : "mt-7 inline-flex items-center justify-center gap-2 rounded-md border border-line px-5 py-3 text-sm text-ink transition-colors hover:border-accent-bronze/40"
                }
              >
                Começar agora
              </a>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-accent-bronze/25 bg-accent-bronze/[0.06] px-6 py-5 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent-bronze-soft" /> 14 dias de garantia — não gostou, devolvemos
            </span>
            <span>· Sem fidelidade</span>
            <span>· Sua IA no ar em 48h</span>
            <span>· Plano anual: 2 meses grátis</span>
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-faint">
          Implantação assistida única de R$ 497 (isenta no plano anual). Busca de leads usa a sua conta
          na fonte de dados — sem custo escondido.
        </p>
      </div>
    </section>
  );
}
