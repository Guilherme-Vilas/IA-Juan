import { ArrowRight, Clock, ShieldCheck, MessagesSquare } from "lucide-react";
import { LiveChat } from "./live-chat";
import { primaryCtaHref } from "@/lib/site";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-hero-glow pt-16">
      <div className="stagger mx-auto max-w-6xl px-6 pb-20 pt-24 text-center md:pt-32">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-canvas-surface/60 px-3.5 py-1.5 text-[12px] text-ink-soft">
          <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-bronze" />
          IA de atendimento e vendas no WhatsApp
        </div>

        <h1 className="mx-auto max-w-4xl font-serif text-hero text-ink">
          Seu melhor vendedor,{" "}
          <span className="italic text-accent-bronze-soft">trabalhando 24 horas</span> no WhatsApp.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
          A Vita OS responde cada lead <strong className="text-ink">em segundos</strong>, qualifica
          com inteligência, agenda a visita e entrega o cliente{" "}
          <strong className="text-ink">mastigado</strong> pro corretor fechar — com você assumindo a
          conversa quando quiser.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={primaryCtaHref()}
            className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
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

        {/* Especificidade = credibilidade: fatos do produto, não promessas */}
        <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-accent-bronze-soft" /> Responde em menos de 30 segundos
          </span>
          <span className="flex items-center gap-1.5">
            <MessagesSquare size={13} className="text-accent-bronze-soft" /> 100% das conversas
            registradas no painel
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-accent-bronze-soft" /> Você assume com um clique
          </span>
        </div>

        {/* Prova visual: a conversa acontecendo na frente do visitante */}
        <div className="mx-auto mt-14 max-w-md">
          <LiveChat />
        </div>
      </div>
    </section>
  );
}
