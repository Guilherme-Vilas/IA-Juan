import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { pool } from "@/lib/db";
import {
  FSM_STATES,
  REASON_LABELS,
  STATE_COLORS,
  STATE_LABELS,
  type LeadState,
  type ClosedReason,
} from "@/lib/types";
import { getCurrentTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type StageFunnelRow = {
  id: number;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  count: string;
};

async function getData(tenantId: number) {
  // Funil pela PIPELINE configurada (etapas do tenant), na ordem das colunas.
  const pipelineFunnel = await pool.query<StageFunnelRow>(
    `SELECT ps.id, ps.name, ps.color, ps.is_won, ps.is_lost,
            COUNT(l.id)::text AS count
       FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
       LEFT JOIN leads l ON l.pipeline_stage_id = ps.id
      WHERE p.tenant_id = $1
      GROUP BY ps.id
      ORDER BY ps.position ASC, ps.id ASC`,
    [tenantId],
  );
  const outcomes = await pool.query<{ won: string; lost: string }>(
    `SELECT COUNT(*) FILTER (WHERE outcome='won')::text AS won,
            COUNT(*) FILTER (WHERE outcome='lost')::text AS lost
       FROM leads WHERE tenant_id = $1`,
    [tenantId],
  );
  const values = await pool.query<{ won_value: string; open_value: string }>(
    `SELECT COALESCE(SUM(value_cents) FILTER (WHERE outcome='won'),0)::text AS won_value,
            COALESCE(SUM(value_cents) FILTER (WHERE status='open' AND outcome IS NULL),0)::text AS open_value
       FROM leads WHERE tenant_id = $1`,
    [tenantId],
  );
  const funnel = await pool.query<{ state: LeadState; count: string }>(
    `SELECT state, COUNT(*)::text AS count FROM leads WHERE tenant_id = $1 GROUP BY state`,
    [tenantId],
  );
  const closed = await pool.query<{ reason: string; count: string }>(
    `SELECT COALESCE(closed_reason, 'aberto') AS reason, COUNT(*)::text AS count
       FROM leads
      WHERE tenant_id = $1 AND status = 'closed'
      GROUP BY closed_reason`,
    [tenantId],
  );
  const totals = await pool.query<{ total: string; abertos: string; fechados: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status='open')::text AS abertos,
            COUNT(*) FILTER (WHERE status='closed')::text AS fechados
       FROM leads
      WHERE tenant_id = $1`,
    [tenantId],
  );
  const agendados = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM leads WHERE tenant_id = $1 AND state='S5_CONFIRMADO'`,
    [tenantId],
  );
  const won = Number(outcomes.rows[0]?.won ?? 0);
  const lost = Number(outcomes.rows[0]?.lost ?? 0);
  return {
    funnel: Object.fromEntries(funnel.rows.map((r) => [r.state, Number(r.count)])) as Record<
      LeadState,
      number
    >,
    pipelineFunnel: pipelineFunnel.rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      is_won: r.is_won,
      is_lost: r.is_lost,
      count: Number(r.count),
    })),
    won,
    lost,
    winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
    wonValue: Number(values.rows[0]?.won_value ?? 0) / 100,
    openValue: Number(values.rows[0]?.open_value ?? 0) / 100,
    closed: closed.rows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
    totals: totals.rows[0]!,
    agendados: Number(agendados.rows[0]?.c ?? 0),
  };
}

export default async function MetricsPage() {
  const tenant = await getCurrentTenant();
  const d = await getData(tenant.id);
  const max = Math.max(...Object.values(d.funnel), 1);
  const pipeMax = Math.max(...d.pipelineFunnel.map((s) => s.count), 1);
  return (
    <>
      <Header title="Métricas" subtitle={`${tenant.name} · Funil e fechamentos`} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total de leads" value={Number(d.totals.total)} />
          <Stat label="Agendados" value={d.agendados} accent />
          <Stat label="Ganhos" value={d.won} />
          <Stat label="Perdidos" value={d.lost} />
          <Stat label="Conversão" value={d.winRate == null ? "—" : `${d.winRate}%`} accent />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Receita ganha" value={formatCurrency(d.wonValue)} accent />
          <Stat label="Pipeline aberto" value={formatCurrency(d.openValue)} />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Funil da pipeline</h2>
            <p className="text-xs text-ink-muted">Distribuição de leads pelas etapas configuradas</p>
          </CardHeader>
          <CardBody className="space-y-2">
            {d.pipelineFunnel.length === 0 && (
              <p className="text-sm text-ink-muted">Pipeline ainda não configurada.</p>
            )}
            {d.pipelineFunnel.map((s) => {
              const pct = (s.count / pipeMax) * 100;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                      {s.is_won && " ✓"}
                      {s.is_lost && " ✕"}
                    </span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-canvas-surface-2">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Funil por estado (IA)</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {FSM_STATES.map((s) => {
              const v = d.funnel[s] ?? 0;
              const pct = (v / max) * 100;
              return (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-muted">{STATE_LABELS[s]}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-canvas-surface-2">
                    <div className={`h-full ${STATE_COLORS[s]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Motivos de fechamento</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {d.closed.length === 0 && (
              <p className="text-sm text-ink-muted">Nenhuma conversa fechada ainda.</p>
            )}
            {d.closed.map((c) => (
              <div key={c.reason} className="flex items-center justify-between text-sm">
                <span>{REASON_LABELS[c.reason as ClosedReason] ?? c.reason}</span>
                <span className="font-semibold">{c.count}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <Card>
      <CardBody>
        <div className={`text-2xl font-bold ${accent ? "text-accent-bronze" : "text-ink"}`}>
          {value}
        </div>
        <div className="text-xs uppercase text-ink-muted">{label}</div>
      </CardBody>
    </Card>
  );
}
