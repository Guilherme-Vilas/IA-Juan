"use client";

import { useEffect } from "react";
import { RefreshCcw, WifiOff } from "lucide-react";

// Erro amigável das rotas do painel — sem stack trace na cara do cliente.
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[painel]", error);
  }, [error]);

  return (
    <div className="grid flex-1 place-items-center px-6">
      <div className="max-w-sm text-center">
        <WifiOff size={32} className="mx-auto mb-3 text-accent-bronze/60" />
        <h2 className="font-serif text-xl text-ink">Não consegui carregar esta tela</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Pode ser uma instabilidade momentânea. Tente de novo — se persistir, fale com o suporte.
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-bronze-metal px-4 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
        >
          <RefreshCcw size={14} /> Tentar de novo
        </button>
      </div>
    </div>
  );
}
