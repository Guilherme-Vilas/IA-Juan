import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { SITE, waLink, primaryCtaHref } from "@/lib/site";

// A prova definitiva pra público cético: falar com a IA AGORA, sem cadastro.
// Quando SITE.demoWhatsapp estiver configurado, o CTA abre a instância demo.

export function DemoStella() {
  const hasDemo = !!SITE.demoWhatsapp;
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="relative overflow-hidden rounded-2xl border border-accent-bronze/25 bg-canvas-surface p-8 text-center md:p-14">
        {/* glow interno */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_-20%,rgba(176,141,87,0.15),transparent_70%)]"
        />
        <div className="relative">
          <p className="mb-3 flex items-center justify-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            <Sparkles size={13} /> Prove antes de acreditar
          </p>
          <h2 className="mx-auto max-w-2xl font-serif text-section-title text-ink">
            Não acredite na gente.{" "}
            <span className="italic text-accent-bronze-soft">Converse com a IA agora.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            {hasDemo
              ? "Chame a Stella no WhatsApp como se você fosse um cliente. Sem cadastro, sem compromisso — veja com seus próprios olhos como ela atende, qualifica e agenda."
              : "Na demonstração, você conversa com a Stella ao vivo, como se fosse um cliente — e vê com seus próprios olhos como ela atende, qualifica e agenda."}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {hasDemo ? (
              <a
                href={waLink(SITE.demoWhatsapp!, "Oi! Quero ver a Stella em ação.")}
                className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
              >
                <MessageCircle size={16} /> Falar com a Stella no WhatsApp
              </a>
            ) : (
              <a
                href={primaryCtaHref()}
                className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
              >
                Ver a Stella ao vivo na demonstração <ArrowRight size={16} />
              </a>
            )}
          </div>
          <p className="mt-4 text-[11px] text-ink-faint">
            {hasDemo ? "Resposta em segundos, a qualquer hora — é ela mesma quem atende." : "15 minutos, sem compromisso."}
          </p>
        </div>
      </div>
    </section>
  );
}
