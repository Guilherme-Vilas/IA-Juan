import { pool } from "../core/db.js";

// Painel de aderencia: como os contatos estao reagindo a cada campanha
// (resposta, classe da resposta, avanco no CRM). Janela = prospects contatados
// nos ultimos N dias.

export type AdherenceClassCounts = {
  interessado: number;
  depois: number;
  neutro: number;
  nao_interessado: number;
  opt_out: number;
  sem_classe: number;
};

export type AdherenceRow = AdherenceClassCounts & {
  campaign_id: number;
  name: string;
  status: string;
  contatados: number;
  respostas: number;
  na_pipeline: number;
  avancaram: number;
  agendados: number;
  ganhos: number;
};

export type AdherenceDay = AdherenceClassCounts & { day: string };

export type CampaignAdherence = {
  days: number;
  campaigns: AdherenceRow[];
  daily: AdherenceDay[];
};

const CLASS_EXPR = `COALESCE(p.reply_class, CASE WHEN p.status = 'opted_out' THEN 'opt_out' ELSE 'sem_classe' END)`;

export async function getCampaignAdherence(
  tenantId: number,
  days: number,
): Promise<CampaignAdherence> {
  const [byCampaign, byDay] = await Promise.all([
    pool.query<Record<string, string | number>>(
      `SELECT c.id AS campaign_id, c.name, c.status,
              COUNT(p.id)::int AS contatados,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL)::int AS respostas,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'interessado')::int AS interessado,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'depois')::int AS depois,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'neutro')::int AS neutro,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'nao_interessado')::int AS nao_interessado,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'opt_out')::int AS opt_out,
              COUNT(p.id) FILTER (WHERE p.replied_at IS NOT NULL AND ${CLASS_EXPR} = 'sem_classe')::int AS sem_classe,
              COUNT(l.id) FILTER (WHERE l.pipeline_stage_id IS NOT NULL)::int AS na_pipeline,
              COUNT(l.id) FILTER (
                WHERE l.state IN ('S2_QUALIFICACAO','S3_EDUCACAO','S4_AGENDAMENTO','S5_CONFIRMADO','HANDOFF')
              )::int AS avancaram,
              COUNT(l.id) FILTER (WHERE l.closed_reason = 'scheduled' OR l.state = 'S5_CONFIRMADO')::int AS agendados,
              COUNT(l.id) FILTER (WHERE l.outcome = 'won')::int AS ganhos
         FROM campaigns c
         JOIN prospects p
           ON p.campaign_id = c.id
          AND p.sent_at >= now() - make_interval(days => $2)
         LEFT JOIN leads l ON l.id = p.lead_id
        WHERE c.tenant_id = $1
        GROUP BY c.id
        ORDER BY COUNT(p.id) DESC, c.id DESC`,
      [tenantId, days],
    ),
    pool.query<Record<string, string | number>>(
      `SELECT to_char((p.replied_at AT TIME ZONE COALESCE(NULLIF(t.timezone, ''), 'America/Sao_Paulo'))::date, 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'interessado')::int AS interessado,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'depois')::int AS depois,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'neutro')::int AS neutro,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'nao_interessado')::int AS nao_interessado,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'opt_out')::int AS opt_out,
              COUNT(*) FILTER (WHERE ${CLASS_EXPR} = 'sem_classe')::int AS sem_classe
         FROM prospects p
         JOIN campaigns c ON c.id = p.campaign_id
         JOIN tenants t ON t.id = c.tenant_id
        WHERE c.tenant_id = $1
          AND p.replied_at >= now() - make_interval(days => $2)
        GROUP BY 1
        ORDER BY 1`,
      [tenantId, days],
    ),
  ]);

  return {
    days,
    campaigns: byCampaign.rows as unknown as AdherenceRow[],
    daily: byDay.rows as unknown as AdherenceDay[],
  };
}
