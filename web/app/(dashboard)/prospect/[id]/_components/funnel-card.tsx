import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CampaignFunnel } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export function FunnelCard({ funnel }: { funnel: CampaignFunnel }) {
  const t = funnel.totals;
  if (t.sends === 0) return null;

  const stages: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Enviadas", value: String(t.sends) },
    { label: "Respostas", value: String(t.replies), sub: pct(t.replies, t.sends) },
    { label: "Interessados", value: String(t.positivos), sub: pct(t.positivos, t.replies) },
    { label: "Leads", value: String(t.leads) },
    { label: "Agendados", value: String(t.agendados) },
    {
      label: "Ganhos",
      value: String(t.ganhos),
      sub: t.valor_ganho_cents > 0 ? formatCurrency(t.valor_ganho_cents / 100) : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp size={14} className="text-accent-bronze-soft" /> Funil da campanha
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {stages.map((s) => (
            <div key={s.label} className="rounded-lg bg-canvas-deep/60 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">{s.label}</div>
              <div className="font-serif text-lg text-ink">{s.value}</div>
              {s.sub && <div className="text-[10px] text-accent-bronze-soft">{s.sub}</div>}
            </div>
          ))}
        </div>

        {funnel.cells.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-2 font-medium">Passo</th>
                  <th className="py-1.5 pr-2 font-medium">Variante</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Enviadas</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Respostas</th>
                  <th className="py-1.5 text-right font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {funnel.cells.map((c, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-1.5 pr-2 text-ink">{c.position ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          c.variant_label === "A"
                            ? "bg-canvas-surface-2 text-ink-soft"
                            : "bg-accent-bronze/15 text-accent-bronze-soft"
                        }`}
                      >
                        {c.variant_label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right text-ink">{c.sends}</td>
                    <td className="py-1.5 pr-2 text-right text-ink">{c.replies}</td>
                    <td className="py-1.5 text-right text-accent-bronze-soft">{pct(c.replies, c.sends)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
