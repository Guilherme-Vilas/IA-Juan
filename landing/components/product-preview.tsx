import { KanbanSquare, Flame, CalendarCheck, UserCheck } from "lucide-react";

// O produto existe — e é assim por dentro. Miniatura fiel do pipeline
// (mesma linguagem visual do dashboard real), construída em CSS.

const COLUMNS = [
  {
    name: "Novo",
    color: "#60A5FA",
    cards: [
      { nome: "Mariana P.", tag: "apto 2q · Água Verde", score: "morno" },
      { nome: "Carlos E.", tag: "consórcio 300k", score: "frio" },
    ],
  },
  {
    name: "Qualificando",
    color: "#FBBF24",
    cards: [{ nome: "Roberto S.", tag: "renda ok · FGTS", score: "quente" }],
  },
  {
    name: "Agendado",
    color: "#C9A876",
    cards: [{ nome: "Ana Lúcia", tag: "visita qui 10h", score: "pronto" }],
  },
  {
    name: "Ganho",
    color: "#4ADE80",
    cards: [{ nome: "Felipe M.", tag: "R$ 420.000", score: "ganho" }],
  },
];

const SCORE_STYLE: Record<string, string> = {
  frio: "bg-canvas-surface-2 text-ink-muted",
  morno: "bg-warning/15 text-warning",
  quente: "bg-orange-400/15 text-orange-300",
  pronto: "bg-success/15 text-success",
  ganho: "bg-success/15 text-success",
};

export function ProductPreview() {
  return (
    <section className="border-y border-line bg-canvas-deep py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
            Por dentro da plataforma
          </p>
          <h2 className="font-serif text-section-title text-ink">
            Um pipeline que <span className="italic text-accent-bronze-soft">a IA move sozinha</span>.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
            Cada conversa vira um card com ficha completa e score. A IA avança o lead conforme
            qualifica — você abre o painel e vê exatamente onde está o dinheiro.
          </p>
        </div>

        {/* janela do produto */}
        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-xl border border-line bg-canvas shadow-elevated">
          <div className="flex items-center gap-2 border-b border-line bg-canvas-surface px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <KanbanSquare size={12} /> app.systemvita.com.br · Pipeline
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 overflow-x-auto p-3 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.name} className="rounded-lg border border-line/70 bg-canvas-surface/50 p-2">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}66` }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {col.name}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {col.cards.map((c) => (
                    <div key={c.nome} className="rounded-md border border-line bg-canvas-surface p-2">
                      <div className="text-[11px] font-medium text-ink">{c.nome}</div>
                      <div className="truncate text-[10px] text-ink-muted">{c.tag}</div>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${SCORE_STYLE[c.score]}`}
                      >
                        {c.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Flame,
              title: "Score de quente a frio",
              desc: "A IA pontua cada lead pelo que descobriu — renda, timing, decisão. O olho vai direto no dinheiro.",
            },
            {
              icon: UserCheck,
              title: "Ficha completa",
              desc: "Profissão, capacidade, objetivo, região. O corretor entra na conversa sabendo tudo.",
            },
            {
              icon: CalendarCheck,
              title: "Agenda conectada",
              desc: "Visitas e calls marcadas caem direto no calendário — sem ida e volta de horários.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-line bg-canvas-surface p-5">
              <Icon size={18} strokeWidth={1.75} className="mb-3 text-accent-bronze-soft" />
              <h3 className="mb-1 font-serif text-[15px] text-ink">{title}</h3>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
