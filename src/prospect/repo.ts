import { pool } from "../core/db.js";

export type Channel = "whatsapp" | "linkedin";
export type CampaignStatus = "draft" | "running" | "paused" | "done";
export type ProspectStatus =
  | "pending"
  | "queued"
  | "sent"
  | "replied"
  | "failed"
  | "skipped"
  | "ready_for_manual";

export type CampaignRow = {
  id: number;
  tenant_id: number;
  name: string;
  channel: Channel;
  template_text: string;
  ai_refine: boolean;
  tone: string;
  status: CampaignStatus;
  rate_per_day: number;
  work_hours_only: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ProspectRow = {
  id: number;
  campaign_id: number;
  tenant_id: number;
  external_id: string;
  nome: string | null;
  empresa: string | null;
  cargo: string | null;
  raw_csv: Record<string, unknown>;
  composed_message: string | null;
  status: ProspectStatus;
  skip_reason: string | null;
  sent_at: Date | null;
  replied_at: Date | null;
  lead_id: number | null;
  error_msg: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProspectInput = {
  external_id: string;
  nome?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  raw_csv?: Record<string, unknown>;
};

export async function createCampaign(input: {
  tenant_id: number;
  name: string;
  channel: Channel;
  template_text: string;
  ai_refine?: boolean;
  tone?: string;
  rate_per_day?: number;
  work_hours_only?: boolean;
}): Promise<CampaignRow> {
  const { rows } = await pool.query<CampaignRow>(
    `INSERT INTO campaigns (tenant_id, name, channel, template_text, ai_refine, tone, rate_per_day, work_hours_only)
     VALUES ($1,$2,$3,$4,COALESCE($5,true),COALESCE($6,'semi-formal'),COALESCE($7,30),COALESCE($8,true))
     RETURNING *`,
    [
      input.tenant_id,
      input.name,
      input.channel,
      input.template_text,
      input.ai_refine ?? null,
      input.tone ?? null,
      input.rate_per_day ?? null,
      input.work_hours_only ?? null,
    ],
  );
  return rows[0]!;
}

export async function getCampaign(tenantId: number, id: number): Promise<CampaignRow | null> {
  const { rows } = await pool.query<CampaignRow>(
    `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return rows[0] ?? null;
}

// Sem filtro de tenant — usado internamente por workers que recebem campaignId solto.
export async function getCampaignById(id: number): Promise<CampaignRow | null> {
  const { rows } = await pool.query<CampaignRow>(`SELECT * FROM campaigns WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listCampaigns(tenantId: number): Promise<CampaignRow[]> {
  const { rows } = await pool.query<CampaignRow>(
    `SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [tenantId],
  );
  return rows;
}

// Listagem global — usada pelo dispatcher tick que precisa varrer todas as campanhas em running.
export async function listAllRunningCampaigns(): Promise<CampaignRow[]> {
  const { rows } = await pool.query<CampaignRow>(
    `SELECT * FROM campaigns WHERE status = 'running' ORDER BY tenant_id, id`,
  );
  return rows;
}

export async function updateCampaignStatus(id: number, status: CampaignStatus): Promise<void> {
  await pool.query(
    `UPDATE campaigns SET status = $1, updated_at = now() WHERE id = $2`,
    [status, id],
  );
}

export async function updateCampaign(
  id: number,
  patch: Partial<Pick<CampaignRow, "name" | "template_text" | "ai_refine" | "tone" | "rate_per_day" | "work_hours_only">>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(id);
  await pool.query(
    `UPDATE campaigns SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
    values,
  );
}

export async function deleteCampaign(id: number): Promise<void> {
  await pool.query(`DELETE FROM campaigns WHERE id = $1`, [id]);
}

export async function insertProspects(
  tenantId: number,
  campaignId: number,
  prospects: ProspectInput[],
): Promise<{ inserted: number; duplicates: number }> {
  if (prospects.length === 0) return { inserted: 0, duplicates: 0 };

  let inserted = 0;
  let duplicates = 0;

  for (const p of prospects) {
    const res = await pool.query(
      `INSERT INTO prospects (tenant_id, campaign_id, external_id, nome, empresa, cargo, raw_csv)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (campaign_id, external_id) DO NOTHING`,
      [
        tenantId,
        campaignId,
        p.external_id,
        p.nome ?? null,
        p.empresa ?? null,
        p.cargo ?? null,
        JSON.stringify(p.raw_csv ?? {}),
      ],
    );
    if (res.rowCount && res.rowCount > 0) inserted++;
    else duplicates++;
  }
  return { inserted, duplicates };
}

export async function listProspects(
  campaignId: number,
  opts: { status?: ProspectStatus; limit?: number } = {},
): Promise<ProspectRow[]> {
  const params: unknown[] = [campaignId];
  let where = `campaign_id = $1`;
  if (opts.status) {
    params.push(opts.status);
    where += ` AND status = $${params.length}`;
  }
  params.push(opts.limit ?? 500);
  const { rows } = await pool.query<ProspectRow>(
    `SELECT * FROM prospects WHERE ${where} ORDER BY created_at ASC LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function getProspect(id: number): Promise<ProspectRow | null> {
  const { rows } = await pool.query<ProspectRow>(`SELECT * FROM prospects WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// Busca prospect ativo POR tenant+external — pra handoff de resposta.
export async function findProspectByExternalId(
  tenantId: number,
  externalId: string,
): Promise<ProspectRow | null> {
  const { rows } = await pool.query<ProspectRow>(
    `SELECT * FROM prospects
       WHERE tenant_id = $1 AND external_id = $2
         AND status IN ('sent','ready_for_manual','queued')
       ORDER BY sent_at DESC NULLS LAST
       LIMIT 1`,
    [tenantId, externalId],
  );
  return rows[0] ?? null;
}

export async function updateProspect(
  id: number,
  patch: Partial<Pick<ProspectRow, "composed_message" | "status" | "skip_reason" | "sent_at" | "replied_at" | "lead_id" | "error_msg">>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(id);
  await pool.query(
    `UPDATE prospects SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
    values,
  );
}

export async function logProspectEvent(
  prospectId: number,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO prospect_events (prospect_id, type, payload) VALUES ($1,$2,$3)`,
    [prospectId, type, JSON.stringify(payload)],
  );
}

export type CampaignMetrics = {
  total: number;
  pending: number;
  queued: number;
  sent: number;
  replied: number;
  failed: number;
  skipped: number;
  ready_for_manual: number;
};

export async function getCampaignMetrics(campaignId: number): Promise<CampaignMetrics> {
  const { rows } = await pool.query<{ status: ProspectStatus; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM prospects WHERE campaign_id = $1 GROUP BY status`,
    [campaignId],
  );
  const m: CampaignMetrics = {
    total: 0,
    pending: 0,
    queued: 0,
    sent: 0,
    replied: 0,
    failed: 0,
    skipped: 0,
    ready_for_manual: 0,
  };
  for (const r of rows) {
    const n = Number(r.n);
    m[r.status] = n;
    m.total += n;
  }
  return m;
}

export async function countSentToday(campaignId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM prospects
       WHERE campaign_id = $1
         AND status IN ('sent','ready_for_manual')
         AND sent_at >= now() - interval '24 hours'`,
    [campaignId],
  );
  return Number(rows[0]?.n ?? "0");
}

export async function pickNextPendingBatch(
  campaignId: number,
  limit: number,
): Promise<ProspectRow[]> {
  const { rows } = await pool.query<ProspectRow>(
    `SELECT * FROM prospects
       WHERE campaign_id = $1 AND status = 'pending'
       ORDER BY id ASC
       LIMIT $2`,
    [campaignId, limit],
  );
  return rows;
}
