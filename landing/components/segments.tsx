import { Building2, Landmark, KeyRound, Quote } from "lucide-react";

const segments = [
  {
    icon: Building2,
    title: "Imobiliárias",
    desc: "Lançamentos, imóveis prontos e locação. Qualifica renda, entrada, FGTS e região — e agenda a visita.",
  },
  {
    icon: Landmark,
    title: "Consórcios",
    desc: "Carta de crédito, capacidade mensal, lance e decisor. Educa o lead e entrega pronto pra simulação.",
  },
  {
    icon: KeyRound,
    title: "Crédito & financiamento",
    desc: "Home equity e financiamento imobiliário. Pré-qualifica garantia, valor e objetivo antes do humano entrar.",
  },
];

export function Segments() {
  return (
    <section id="segmentos" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
          Para quem é
        </p>
        <h2 className="font-serif text-section-title text-ink">
          Um playbook pronto para cada segmento.
        </h2>
        <p className="mt-4 text-[14px] text-ink-muted">
          A IA já vem treinada para o seu mercado — e você ajusta tudo pelo painel, sem programador.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {segments.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-line bg-canvas-surface p-7 shadow-card">
            <Icon size={22} strokeWidth={1.6} className="mb-4 text-accent-bronze-soft" />
            <h3 className="mb-2 font-serif text-lg text-ink">{title}</h3>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">{desc}</p>
          </div>
        ))}
      </div>

      {/* Prova social */}
      <div className="mt-14 rounded-xl border border-line bg-canvas-surface p-8 md:p-10">
        <Quote size={28} className="mb-4 text-accent-bronze/60" />
        <p className="font-serif text-xl italic leading-relaxed text-ink md:text-2xl">
          "Antes eu perdia lead porque demorava pra responder. Agora a IA atende na hora, qualifica
          e me manda o cliente pronto pra fechar. Mudou meu jogo."
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full border border-line bg-canvas-surface-2 text-[12px] font-semibold text-ink">
            JM
          </div>
          <div className="text-[13px]">
            <div className="text-ink">Juan Monteiro</div>
            <div className="text-ink-faint">Corretor · Consórcio e imóveis</div>
          </div>
        </div>
      </div>
    </section>
  );
}
