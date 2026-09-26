import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { pool } from "@/lib/db";
import { adminCall } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { Download } from "lucide-react";
import { DailyChart } from "./_components/daily-chart";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

type FunnelReport = {
  days: number;
  totals: {
    novos: number;
    engajaram: number;
    qualificados: number;
    agendados: number;
    realizadas: number;
    no_show: number;
    ganhos: number;
    perdidos: number;
    valor_ganho_cents: number;
  };
  por_origem: Array<{ source: string; novos: number; agendados: number; ganhos: number }>;
  por_vendedor: Array<{ user_id: number | null; name: string; leads: number; agendados: number; ganhos: number }>;
  por_dia: Array<{ day: string; novos: number; agendados: number }>;
};

type StageFunnelRow = { id: number; name: string; color: string; is_won: boolean; is_lost: boolean; count: string };

const SOURCE_LABELS: Record<string, string> = {
  campaign: "Campanha de prospecção",
  captura: "Captura (site/formulário)",
  demo: "Demonstração",
  orgânico: "Orgânico (chegou no WhatsApp)",
};

function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-canvas-deep/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      {sub && <div className="text-[11px] text-ink-soft">{sub}</div>}
    </div>
  );
}

export default async function MetricsPage({ searchParams }: { searchParams?: { days?: string } }) {
  const tenant = await getCurrentTenant();
  const days = PERIODS.some((p) => p.days === Number(searchParams?.days)) ? Number(searchParams?.days) : 30;

  const [report, stagesRes] = await Promise.all([
    adminCall(`/admin/tenants/${tenant.slug}/reports/funnel?days=${days}`, { method: "GET" }) as Promise<FunnelReport>,
    pool.query<StageFunnelRow>(
      `SELECT ps.id, ps.name, ps.color, ps.is_won, ps.is_lost, COUNT(l.id)::text AS count
         FROM pipeline_stages ps
         JOIN pipelines p ON p.id = ps.pipeline_id
         LEFT JOIN leads l ON l.pipeline_stage_id = ps.id AND l.status = 'open'
        WHERE p.tenant_id = $1
        GROUP BY ps.id ORDER BY ps.position ASC, ps.id ASC`,
      [tenant.id],
    ),
  ]);

  const t = report.totals;
  const stageRows = stagesRes.rows.map((r) => ({ ...r, count: Number(r.count) }));
  const maxStage = Math.max(1, ...stageRows.map((r) => r.count));

  return (
    <>
      <Header
        title="Métricas"
        subtitle={`${tenant.name} · últimos ${days} dias`}
        action={
          <div className="flex items-center gap-2">
            <a
              href="/api/export/leads"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-ink-soft hover:text-ink"
            >
              <Download size={13} /> Exportar CSV
            </a>
            <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <Link
                  key={p.days}
                  href={`/metrics?days=${p.days}`}
                  aria-current={p.days === days ? "page" : undefined}
                  className={`rounded px-2.5 py-1 text-xs ${
                    p.days === days ? "bg-canvas-surface-2 text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        {/* O funil do período: quanto entrou e quanto virou reunião/venda */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Kpi label="Leads novos" value={String(t.novos)} />
          <Kpi label="Engajaram" value={String(t.engajaram)} sub={pct(t.engajaram, t.novos)} />
          <Kpi label="Qualificados" value={String(t.qualificados)} sub={pct(t.qualificados, t.novos)} />
          <Kpi label="Reuniões" value={String(t.agendados)} sub={pct(t.agendados, t.novos)} />
          <Kpi label="Realizadas" value={String(t.realizadas)} sub={pct(t.realizadas, t.agendados)} />
          <Kpi label="Faltas" value={String(t.no_show)} sub={pct(t.no_show, t.agendados)} />
          <Kpi label="Ganhos" value={String(t.ganhos)} sub={t.perdidos ? `${t.perdidos} perdidos` : undefined} />
          <Kpi
            label="Valor ganho"
            value={t.valor_ganho_cents ? formatCurrency(t.valor_ganho_cents / 100) : "—"}
          />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Movimento por dia</h2>
          </CardHeader>
          <CardBody>
            <DailyChart data={report.por_dia} />
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Por origem</h2>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                    <th className="py-1.5 pr-2 font-medium">Origem</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Novos</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Reuniões</th>
                    <th className="py-1.5 text-right font-medium">Ganhos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.por_origem.map((r) => (
                    <tr key={r.source} className="border-b border-line/50">
                      <td className="py-1.5 pr-2 text-ink">{SOURCE_LABELS[r.source] ?? r.source}</td>
                      <td className="py-1.5 pr-2 text-right text-ink">{r.novos}</td>
                      <td className="py-1.5 pr-2 text-right text-ink">{r.agendados}</td>
                      <td className="py-1.5 text-right text-ink">{r.ganhos}</td>
                    </tr>
                  ))}
                  {report.por_origem.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-ink-faint">
                        Sem leads no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Por responsável</h2>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                    <th className="py-1.5 pr-2 font-medium">Responsável</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Leads</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Reuniões</th>
                    <th className="py-1.5 text-right font-medium">Ganhos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.por_vendedor.map((r) => (
                    <tr key={`${r.user_id}`} className="border-b border-line/50">
                      <td className="py-1.5 pr-2 text-ink">{r.name}</td>
                      <td className="py-1.5 pr-2 text-right text-ink">{r.leads}</td>
                      <td className="py-1.5 pr-2 text-right text-ink">{r.agendados}</td>
                      <td className="py-1.5 text-right text-ink">{r.ganhos}</td>
                    </tr>
                  ))}
                  {report.por_vendedor.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-ink-faint">
                        Sem atividade no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Onde os leads estão agora (funil da pipeline)</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {stageRows.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs text-ink-soft">{r.name}</span>
                <div className="h-4 flex-1 rounded-[4px] bg-canvas-deep/60">
                  <div
                    className="h-full rounded-[4px]"
                    style={{ width: `${(r.count / maxStage) * 100}%`, backgroundColor: r.color, minWidth: r.count ? 6 : 0 }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-ink">{r.count}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
