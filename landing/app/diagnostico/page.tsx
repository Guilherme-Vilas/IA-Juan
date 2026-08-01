import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";
import { DiagnosticoForm } from "./_components/diagnostico-form";

export const metadata: Metadata = {
  title: "Diagnóstico Comercial Gratuito · Vita OS",
  description:
    "Descubra onde o seu comercial está perdendo leads — análise gratuita e honesta em 1 dia útil, feita pela equipe da Vita OS.",
};

export default function DiagnosticoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-hero-glow">
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <a href="/" className="mb-10 flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 border border-line" />
          <span className="font-serif text-lg text-ink">Vita OS</span>
        </a>

        <div className="stagger">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            Gratuito · sem compromisso · retorno em 1 dia útil
          </p>
          <h1 className="font-serif text-section-title text-ink">
            Onde o seu comercial está <span className="italic text-accent-bronze-soft">perdendo dinheiro</span>?
          </h1>
          <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
            Responda 7 perguntas rápidas (2 minutos). Nossa equipe analisa seu cenário e devolve um
            raio-X honesto: quantos leads você está deixando na mesa e o que dá pra recuperar — com
            ou sem a gente.
          </p>
        </div>

        <div className="mt-10">
          <DiagnosticoForm />
        </div>
      </div>
    </main>
  );
}
