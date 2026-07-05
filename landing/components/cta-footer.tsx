import { ArrowRight, ShieldCheck, Unlock, Headset, FileCheck2, Instagram, Mail } from "lucide-react";
import { LogoMark } from "./logo";
import { SITE, primaryCtaHref, waLink } from "@/lib/site";

export function CtaFooter() {
  return (
    <>
      {/* Risco invertido — remove o medo de assinar */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Unlock, title: "Sem fidelidade", desc: "Cancele quando quiser. Seus leads e histórico são seus." },
            { icon: Headset, title: "Onboarding assistido", desc: "A gente configura a IA com você — tom de voz, regras e agenda." },
            { icon: ShieldCheck, title: "Humano no controle", desc: "Você assume qualquer conversa com um clique, quando quiser." },
            { icon: FileCheck2, title: "LGPD levada a sério", desc: "Opt-out automático e dados usados só na sua operação." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-line bg-canvas-surface p-5">
              <Icon size={17} strokeWidth={1.75} className="mb-3 text-accent-bronze-soft" />
              <h3 className="mb-1 font-serif text-[15px] text-ink">{title}</h3>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section id="contato" className="border-t border-line bg-hero-glow">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-serif text-section-title text-ink">
            Pare de perder lead <span className="italic text-accent-bronze-soft">por demora</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Coloque a Vita OS pra atender seu WhatsApp e veja a diferença já na primeira semana.
            Demonstração de 15 minutos, sem compromisso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={primaryCtaHref()}
              className="shine inline-flex items-center gap-2 rounded-md bg-bronze-metal px-6 py-3 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
            >
              Agendar demonstração <ArrowRight size={16} />
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="inline-flex items-center gap-2 rounded-md border border-line px-6 py-3 text-sm text-ink transition-colors hover:border-line-strong"
            >
              <Mail size={15} /> {SITE.email}
            </a>
          </div>
        </div>
      </section>

      {/* Footer — legitimidade: contato real, CNPJ, páginas legais */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <LogoMark className="h-7 w-7 border border-line" />
                <span className="font-serif text-ink">Vita OS</span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                Plataforma de atendimento e vendas com IA no WhatsApp para imobiliárias, consórcios
                e crédito.
              </p>
            </div>

            <div className="flex gap-14 text-[12.5px]">
              <div>
                <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                  Produto
                </p>
                <div className="flex flex-col gap-1.5 text-ink-muted">
                  <a href="#produto" className="transition-colors hover:text-ink">O que faz</a>
                  <a href="#como-funciona" className="transition-colors hover:text-ink">Como funciona</a>
                  <a href="#faq" className="transition-colors hover:text-ink">Dúvidas frequentes</a>
                  <a href={SITE.appUrl} className="transition-colors hover:text-ink">Entrar na plataforma</a>
                </div>
              </div>
              <div>
                <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                  Contato & legal
                </p>
                <div className="flex flex-col gap-1.5 text-ink-muted">
                  <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-ink">
                    {SITE.email}
                  </a>
                  {SITE.contactWhatsapp && (
                    <a
                      href={waLink(SITE.contactWhatsapp, "Olá! Vim pelo site.")}
                      className="transition-colors hover:text-ink"
                    >
                      WhatsApp comercial
                    </a>
                  )}
                  {SITE.instagram && (
                    <a
                      href={`https://instagram.com/${SITE.instagram}`}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1 transition-colors hover:text-ink"
                    >
                      <Instagram size={12} /> @{SITE.instagram}
                    </a>
                  )}
                  <a href="/privacidade" className="transition-colors hover:text-ink">
                    Política de Privacidade
                  </a>
                  <a href="/termos" className="transition-colors hover:text-ink">
                    Termos de Uso
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-[11px] text-ink-faint sm:flex-row">
            <span>
              © {new Date().getFullYear()} {SITE.name} · {SITE.domain}
              {SITE.cnpj && <> · CNPJ {SITE.cnpj}</>}
            </span>
            <span>Feito no Brasil, para o mercado brasileiro.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
