const steps = [
  {
    n: "01",
    title: "O lead chama no WhatsApp",
    desc: "Veio de anúncio, portal, tráfego ou indicação. A Vita OS responde em segundos, a qualquer hora — sem fila, sem 'já te respondo'.",
  },
  {
    n: "02",
    title: "A IA qualifica conversando",
    desc: "Descobre o que importa pro seu negócio com naturalidade. Comenta, elogia o gosto, demonstra conhecimento — e extrai renda, interesse e timing.",
  },
  {
    n: "03",
    title: "Agenda a visita ou a call",
    desc: "Quando o lead está qualificado, oferece horários reais da agenda e marca. Tudo registrado no painel e no calendário.",
  },
  {
    n: "04",
    title: "Entrega o lead pro corretor",
    desc: "O corretor recebe a ficha completa com score. Assume a conversa quando quiser, com o trabalho pesado já feito.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-line bg-canvas-deep py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            Como funciona
          </p>
          <h2 className="font-serif text-section-title text-ink">
            Do primeiro "oi" à visita marcada, no piloto automático.
          </h2>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="bg-canvas-surface p-7">
              <div className="mb-4 font-serif text-3xl text-accent-bronze/70">{s.n}</div>
              <h3 className="mb-2 font-serif text-xl text-ink">{s.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
