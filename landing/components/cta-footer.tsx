import { ArrowRight } from "lucide-react";
import { LogoMark } from "./logo";

export function CtaFooter() {
  return (
    <>
      {/* CTA final */}
      <section id="contato" className="border-t border-line bg-hero-glow">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-serif text-section-title text-ink">
            Pare de perder lead por demora.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Coloque a Vita OS pra atender seu WhatsApp e veja a diferença já na primeira semana.
            Agende uma demonstração sem compromisso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="https://wa.me/5541999999999?text=Quero%20conhecer%20a%20Vita%20OS"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-ink-inverse transition-colors hover:bg-white"
            >
              Agendar demonstração <ArrowRight size={16} />
            </a>
            <a
              href="mailto:contato@systemvita.com.br"
              className="inline-flex items-center gap-2 rounded-md border border-line px-6 py-3 text-sm text-ink transition-colors hover:border-line-strong"
            >
              contato@systemvita.com.br
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7 border border-line" />
            <span className="font-serif text-ink">Vita OS</span>
          </div>
          <p className="text-[12px] text-ink-faint">
            © {new Date().getFullYear()} Vita OS · systemvita.com.br
          </p>
        </div>
      </footer>
    </>
  );
}
