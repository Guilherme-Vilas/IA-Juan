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

export const dynamic = "force-dynamic";

async function getData(tenantId: number) {
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
  return {
    funnel: Object.fromEntries(funnel.rows.map((r) => [r.state, Number(r.count)])) as Record<
      LeadState,
      number
    >,
    closed: closed.rows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
    totals: totals.rows[0]!,
    agendados: Number(agendados.rows[0]?.c ?? 0),
  };
}

export default async function MetricsPage() {
  const tenant = await getCurrentTenant();
  const d = await getData(tenant.id);
  const max = Math.max(...Object.values(d.funnel), 1);
  return (
    <>
      <Header title="Métricas" subtitle={`${tenant.name} · Funil e fechamentos`} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Stat label="Total de leads" value={Number(d.totals.total)} />
          <Stat label="Abertos" value={Number(d.totals.abertos)} />
          <Stat label="Fechados" value={Number(d.totals.fechados)} />
          <Stat label="Agendados" value={d.agendados} accent />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Funil por estado</h2>
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
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
