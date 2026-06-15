import { Brain, CalendarClock, Send, Server, Gauge, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Qualificação inteligente",
    desc: "A IA conduz a conversa como um SDR experiente: descobre renda, interesse, urgência e capacidade — e só agenda quando o lead está pronto.",
  },
  {
    icon: CalendarClock,
    title: "Agenda integrada",
    desc: "Agenda própria + Google Calendar opcional. A IA cruza disponibilidade, oferece horários reais e marca a visita sem intervenção humana.",
  },
  {
    icon: Send,
    title: "Prospecção ativa",
    desc: "Suba uma lista, defina a cadência e a IA aborda novos leads no ritmo certo — respeitando horário comercial e sem soar robô.",
  },
  {
    icon: Server,
    title: "Multi-instância",
    desc: "Um painel, vários números de WhatsApp e equipes. Provisione um novo cliente em minutos, com QR code direto na tela.",
  },
  {
    icon: Gauge,
    title: "Lead mastigado",
    desc: "O corretor recebe a ficha completa — profissão, renda, objetivo, região — e um score de quente a frio. Chega pra fechar, não pra investigar.",
  },
  {
    icon: ShieldCheck,
    title: "Humano no controle",
    desc: "A qualquer momento o corretor assume a conversa com um clique. A IA pausa, ele conduz, e devolve quando quiser.",
  },
];

export function Features() {
  return (
    <section id="produto" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
          O que a Vita OS faz
        </p>
        <h2 className="font-serif text-section-title text-ink">
          Tudo que um time de pré-vendas faz — sem o custo de um time.
        </h2>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-line bg-canvas-surface p-6 shadow-card transition-colors hover:border-line-strong"
          >
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg border border-line bg-canvas-surface-2">
              <Icon size={18} strokeWidth={1.75} className="text-accent-bronze-soft" />
            </div>
            <h3 className="mb-2 font-serif text-lg text-ink">{title}</h3>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
