import { LogoMark } from "./logo";

// Layout compartilhado das páginas legais (/privacidade e /termos).
export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: Array<{ title: string; body: string[] }>;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <a href="/" className="mb-10 flex items-center gap-2.5">
        <LogoMark className="h-8 w-8 border border-line" />
        <span className="font-serif text-lg text-ink">Vita OS</span>
      </a>
      <h1 className="font-serif text-3xl text-ink">{title}</h1>
      <p className="mt-2 text-[12px] text-ink-faint">Última atualização: julho de 2026</p>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 font-serif text-lg text-ink">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mb-2 text-[14px] leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
      <a href="/" className="mt-12 inline-block text-[13px] text-accent-bronze-soft hover:underline">
        ← Voltar para o site
      </a>
    </main>
  );
}
