import { MessageSquare, CalendarCheck, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-hero-glow pt-16">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center md:pt-32">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-canvas-surface/60 px-3.5 py-1.5 text-[12px] text-ink-soft">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-bronze" />
          IA de atendimento e vendas no WhatsApp
        </div>

        <h1 className="mx-auto max-w-4xl font-serif text-hero text-ink">
          Seu melhor vendedor,{" "}
          <span className="italic text-accent-bronze-soft">trabalhando 24 horas</span> no WhatsApp.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
          A Vita OS atende cada lead na hora, qualifica com inteligência, agenda a visita e entrega
          o cliente <strong className="text-ink">mastigado</strong> pro corretor fechar. Sem você
          perder mais nenhuma oportunidade enquanto dorme.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#contato"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-ink-inverse transition-colors hover:bg-white"
          >
            Agendar demonstração <ArrowRight size={16} />
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-md border border-line px-6 py-3 text-sm text-ink transition-colors hover:border-line-strong"
          >
            Ver como funciona
          </a>
        </div>

        {/* Mock de conversa — prova visual */}
        <div className="mx-auto mt-16 max-w-md">
          <div className="rounded-xl border border-line bg-canvas-surface p-4 text-left shadow-elevated">
            <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
              <MessageSquare size={15} className="text-accent-bronze" />
              <span className="text-[12px] text-ink-muted">Conversa · há 2 min</span>
            </div>
            <div className="space-y-2.5 text-[13px]">
              <Bubble side="in">Oi, vi o apartamento de 2 quartos. Ainda tá disponível?</Bubble>
              <Bubble side="out">
                Oi! Tá sim 🙌 Pra eu te direcionar certo: vai ser pra morar ou investir?
              </Bubble>
              <Bubble side="in">Pra morar. Tenho uns 50 mil de entrada</Bubble>
              <Bubble side="out">
                Perfeito! Com essa entrada já abre um bom leque. Quer ver pessoalmente amanhã ou
                quinta?
              </Bubble>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-accent-bronze/10 px-3 py-2 text-[12px] text-accent-bronze-soft">
              <CalendarCheck size={14} /> Visita agendada · lead enviado ao corretor
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({ side, children }: { side: "in" | "out"; children: React.ReactNode }) {
  return (
    <div className={side === "out" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          side === "out"
            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-accent-bronze/20 px-3 py-2 text-ink"
            : "max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas-surface-2 px-3 py-2 text-ink-soft"
        }
      >
        {children}
      </div>
    </div>
  );
}
