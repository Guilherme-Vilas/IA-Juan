import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

// Primeiro uso: em vez de um kanban vazio, um caminho claro de ativação.
// Some sozinho quando o primeiro lead chegar (a page só renderiza com 0 leads).
export type OnboardingStatus = {
  whatsappConnected: boolean;
  agentConfigured: boolean;
  hasCampaign: boolean;
};

const STEPS: Array<{
  key: keyof OnboardingStatus | "waitLead";
  title: string;
  desc: string;
  href: string;
  cta: string;
}> = [
  {
    key: "whatsappConnected",
    title: "Conectar o WhatsApp",
    desc: "Escaneie o QR code pra IA receber e responder mensagens.",
    href: "/settings",
    cta: "Conectar",
  },
  {
    key: "agentConfigured",
    title: "Configurar o agente",
    desc: "Nome, tom de voz, produtos e regras de qualificação.",
    href: "/settings",
    cta: "Configurar",
  },
  {
    key: "hasCampaign",
    title: "Criar a primeira campanha",
    desc: "Importe uma lista e deixe a IA abordar por você — ou divulgue seu número.",
    href: "/prospect/new",
    cta: "Criar campanha",
  },
];

export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
  const done = (k: (typeof STEPS)[number]["key"]) => (k === "waitLead" ? false : status[k]);
  const firstPending = STEPS.find((s) => !done(s.key));

  return (
    <div className="mx-auto mt-6 w-full max-w-xl px-4">
      <div className="rounded-xl border border-line bg-canvas-surface/60 p-5 shadow-card">
        <h2 className="font-serif text-lg text-ink">Bem-vindo! Vamos colocar sua IA pra trabalhar</h2>
        <p className="mt-1 text-xs text-ink-muted">
          3 passos e o funil começa a se preencher sozinho. Seus leads vão aparecer aqui.
        </p>
        <ol className="mt-4 space-y-2">
          {STEPS.map((s) => {
            const ok = done(s.key);
            const isNext = firstPending?.key === s.key;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isNext ? "border-accent-bronze/50 bg-accent-bronze/[0.06]" : "border-line bg-canvas-deep/50"
                }`}
              >
                {ok ? (
                  <CheckCircle2 size={18} className="shrink-0 text-success" aria-label="Concluído" />
                ) : (
                  <Circle size={18} className="shrink-0 text-ink-faint" aria-label="Pendente" />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${ok ? "text-ink-muted line-through" : "text-ink"}`}>{s.title}</div>
                  {!ok && <div className="text-xs text-ink-muted">{s.desc}</div>}
                </div>
                {!ok && (
                  <Link
                    href={s.href}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      isNext
                        ? "bg-bronze-metal text-ink-inverse"
                        : "border border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    {s.cta} <ArrowRight size={12} />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
