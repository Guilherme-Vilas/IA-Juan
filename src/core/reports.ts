import { pool } from "./db.js";
import { redis } from "./redis.js";
import { logger } from "./logger.js";
import { sendText } from "./evolution.js";
import { isWhatsappConnected } from "./connection-monitor.js";
import type { TenantRow } from "./tenants.js";

// Relatórios do funil com PERÍODO (antes: contagens all-time, sem recorte) +
// resumo semanal por WhatsApp pro dono. Fonte: leads, appointments e
// lead_stage_events (que já registra toda transição).

export type FunnelReport = {
  days: number;
  totals: {
    novos: number;
    engajaram: number; // mandaram ao menos 1 mensagem
    qualificados: number; // chegaram a S2+
    agendados: number; // reuniões criadas no período
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

const QUALIFIED_STATES = ["S2_QUALIFICACAO", "S3_EDUCACAO", "S4_AGENDAMENTO", "S5_CONFIRMADO", "HANDOFF"];

export async function getFunnelReport(tenantId: number, days: number): Promise<FunnelReport> {
  const [totals, origem, vendedor, porDia] = await Promise.all([
    pool.query<Record<string, string>>(
      `SELECT
         COUNT(*) FILTER (WHERE l.created_at >= now() - make_interval(days => $2))::text AS novos,
         COUNT(*) FILTER (WHERE l.created_at >= now() - make_interval(days => $2) AND l.last_user_at IS NOT NULL)::text AS engajaram,
         (SELECT COUNT(DISTINCT e.lead_id) FROM lead_stage_events e
           WHERE e.tenant_id = $1 AND e.created_at >= now() - make_interval(days => $2)
             AND e.to_state = ANY($3))::text AS qualificados,
         (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = $1
           AND a.created_at >= now() - make_interval(days => $2))::text AS agendados,
         (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = $1
           AND a.status = 'completed' AND a.scheduled_at >= now() - make_interval(days => $2))::text AS realizadas,
         (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = $1
           AND a.status = 'no_show' AND a.scheduled_at >= now() - make_interval(days => $2))::text AS no_show,
         COUNT(*) FILTER (WHERE l.outcome = 'won' AND l.outcome_at >= now() - make_interval(days => $2))::text AS ganhos,
         COUNT(*) FILTER (WHERE l.outcome = 'lost' AND l.outcome_at >= now() - make_interval(days => $2))::text AS perdidos,
         COALESCE(SUM(l.value_cents) FILTER (WHERE l.outcome = 'won' AND l.outcome_at >= now() - make_interval(days => $2)), 0)::text AS valor_ganho_cents
       FROM leads l WHERE l.tenant_id = $1`,
      [tenantId, days, QUALIFIED_STATES],
    ),
    pool.query<{ source: string; novos: string; agendados: string; ganhos: string }>(
      `SELECT COALESCE(NULLIF(split_part(l.source, ':', 1), ''), 'orgânico') AS source,
              COUNT(*)::text AS novos,
              COUNT(a.id)::text AS agendados,
              COUNT(*) FILTER (WHERE l.outcome = 'won')::text AS ganhos
         FROM leads l
         LEFT JOIN appointments a ON a.lead_id = l.id
        WHERE l.tenant_id = $1 AND l.created_at >= now() - make_interval(days => $2)
        GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10`,
      [tenantId, days],
    ),
    pool.query<{ user_id: number | null; name: string; leads: string; agendados: string; ganhos: string }>(
      `SELECT l.assigned_user_id AS user_id,
              COALESCE(u.name, 'Sem responsável') AS name,
              COUNT(DISTINCT l.id)::text AS leads,
              COUNT(a.id)::text AS agendados,
              COUNT(DISTINCT l.id) FILTER (WHERE l.outcome = 'won')::text AS ganhos
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_user_id
         LEFT JOIN appointments a ON a.lead_id = l.id AND a.created_at >= now() - make_interval(days => $2)
        WHERE l.tenant_id = $1 AND l.updated_at >= now() - make_interval(days => $2)
        GROUP BY 1, 2 ORDER BY COUNT(DISTINCT l.id) DESC LIMIT 10`,
      [tenantId, days],
    ),
    pool.query<{ day: string; novos: string; agendados: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COALESCE(n.novos, 0)::text AS novos,
              COALESCE(ag.agendados, 0)::text AS agendados
         FROM generate_series(
                (now() - make_interval(days => $2 - 1))::date, now()::date, '1 day'
              ) AS d(day)
         LEFT JOIN (
           SELECT created_at::date AS day, COUNT(*) AS novos FROM leads
            WHERE tenant_id = $1 AND created_at >= now() - make_interval(days => $2) GROUP BY 1
         ) n ON n.day = d.day
         LEFT JOIN (
           SELECT created_at::date AS day, COUNT(*) AS agendados FROM appointments
            WHERE tenant_id = $1 AND created_at >= now() - make_interval(days => $2) GROUP BY 1
         ) ag ON ag.day = d.day
        ORDER BY 1`,
      [tenantId, days],
    ),
  ]);

  const t = totals.rows[0]!;
  const n = (v: string | undefined) => Number(v ?? 0);
  return {
    days,
    totals: {
      novos: n(t.novos),
      engajaram: n(t.engajaram),
      qualificados: n(t.qualificados),
      agendados: n(t.agendados),
      realizadas: n(t.realizadas),
      no_show: n(t.no_show),
      ganhos: n(t.ganhos),
      perdidos: n(t.perdidos),
      valor_ganho_cents: n(t.valor_ganho_cents),
    },
    por_origem: origem.rows.map((r) => ({
      source: r.source,
      novos: Number(r.novos),
      agendados: Number(r.agendados),
      ganhos: Number(r.ganhos),
    })),
    por_vendedor: vendedor.rows.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      leads: Number(r.leads),
      agendados: Number(r.agendados),
      ganhos: Number(r.ganhos),
    })),
    por_dia: porDia.rows.map((r) => ({ day: r.day, novos: Number(r.novos), agendados: Number(r.agendados) })),
  };
}

// ===== Resumo semanal por WhatsApp =====
// Toda segunda de manhã (hora local do tenant), 1x por semana. Compara com a
// semana anterior pra dar noção de tendência sem precisar abrir o painel.

function tenantHour(tenant: TenantRow): number {
  try {
    return (
      parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: tenant.timezone || "America/Sao_Paulo",
          hour: "numeric",
          hour12: false,
        }).format(new Date()),
        10,
      ) % 24
    );
  } catch {
    return 12;
  }
}

function tenantWeekday(tenant: TenantRow): number {
  try {
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: tenant.timezone || "America/Sao_Paulo",
      weekday: "short",
    }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  } catch {
    return new Date().getDay();
  }
}

const isoWeek = () => {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}w${Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7)}`;
};

function trend(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "↑" : "→";
  if (cur > prev) return `↑ +${cur - prev}`;
  if (cur < prev) return `↓ -${prev - cur}`;
  return "→";
}

export async function sendWeeklyDigests(tenants: TenantRow[]): Promise<void> {
  for (const tenant of tenants) {
    if (!tenant.active || !tenant.owner_whatsapp_e164) continue;
    if (tenantWeekday(tenant) !== 1) continue; // segunda-feira
    const hour = tenantHour(tenant);
    if (hour < 8 || hour >= 11) continue; // janela da manhã
    const dedupe = await redis
      .set(`digest:${tenant.id}:${isoWeek()}`, "1", "EX", 8 * 24 * 3600, "NX")
      .catch(() => null);
    if (dedupe !== "OK") continue;
    if (!(await isWhatsappConnected(tenant))) continue;

    try {
      const [cur, prev14] = await Promise.all([getFunnelReport(tenant.id, 7), getFunnelReport(tenant.id, 14)]);
      const p = {
        novos: prev14.totals.novos - cur.totals.novos,
        agendados: prev14.totals.agendados - cur.totals.agendados,
        ganhos: prev14.totals.ganhos - cur.totals.ganhos,
      };
      const valor =
        cur.totals.valor_ganho_cents > 0
          ? `\n💰 Valor ganho: R$ ${(cur.totals.valor_ganho_cents / 100).toLocaleString("pt-BR")}`
          : "";
      const text =
        `📊 *Resumo da semana — ${tenant.name}*\n\n` +
        `Leads novos: *${cur.totals.novos}* (${trend(cur.totals.novos, p.novos)})\n` +
        `Engajaram: *${cur.totals.engajaram}*\n` +
        `Qualificados: *${cur.totals.qualificados}*\n` +
        `Reuniões marcadas: *${cur.totals.agendados}* (${trend(cur.totals.agendados, p.agendados)})\n` +
        `Realizadas: *${cur.totals.realizadas}* · Faltas: *${cur.totals.no_show}*\n` +
        `Ganhos: *${cur.totals.ganhos}* (${trend(cur.totals.ganhos, p.ganhos)})${valor}\n\n` +
        `Detalhes no painel → Métricas.`;
      await sendText(tenant, tenant.owner_whatsapp_e164, text);
      logger.info({ tenant: tenant.slug }, "resumo semanal enviado");
    } catch (err) {
      logger.error({ err, tenant: tenant.slug }, "resumo semanal falhou");
      await redis.del(`digest:${tenant.id}:${isoWeek()}`).catch(() => undefined);
    }
  }
}
