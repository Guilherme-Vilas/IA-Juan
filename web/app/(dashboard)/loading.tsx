// Skeleton global das rotas do painel — feedback imediato em toda navegação
// (antes: a tela congelava sem nenhum sinal até o servidor responder).
export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Carregando">
      <div className="glass hairline-b flex h-16 items-center px-4 md:px-8">
        <div className="h-5 w-40 animate-pulse rounded bg-canvas-surface-2" />
      </div>
      <div className="flex-1 space-y-3 overflow-hidden px-4 py-4 md:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-canvas-surface/60" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-line bg-canvas-surface/40" />
        <div className="h-40 animate-pulse rounded-xl border border-line bg-canvas-surface/30" />
      </div>
    </div>
  );
}
