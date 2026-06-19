import { pool } from "./db.js";
import { logger } from "./logger.js";
import { getTenantById } from "./tenants.js";
import { sendText } from "./evolution.js";

// Varre leads "esfriando": abertos, sem pausa, parados numa etapa com SLA
// (sla_hours) por mais tempo que o permitido e ainda nao alertados. Notifica o
// dono via WhatsApp e marca sla_alerted_at (uma vez por entrada na etapa).
// Roda no tick repeatable (prospect-tick) — ver workers/prospect.worker.ts.
export async function scanSlaBreaches(limit = 50): Promise<number> {
  const { rows } = await pool.query<{
    lead_id: number;
    tenant_id: number;
    wa_id: string;
    nome: string | null;
    stage_name: string;
    sla_hours: number;
  }>(
    `SELECT l.id AS lead_id, l.tenant_id, l.wa_id, l.nome,
            ps.name AS stage_name, ps.sla_hours
       FROM leads l
       JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      WHERE l.status = 'open'
        AND l.paused = false
        AND ps.sla_hours IS NOT NULL
        AND ps.is_won = false AND ps.is_lost = false
        AND l.sla_alerted_at IS NULL
        AND l.stage_entered_at < now() - (ps.sla_hours || ' hours')::interval
      ORDER BY l.stage_entered_at ASC
      LIMIT $1`,
    [limit],
  );

  let notified = 0;
  for (const r of rows) {
    const tenant = await getTenantById(r.tenant_id);
    if (!tenant?.owner_whatsapp_e164) continue;
    const who = r.nome || r.wa_id;
    const text =
      `⏰ Lead esfriando: *${who}* está há mais de ${r.sla_hours}h na etapa ` +
      `"${r.stage_name}" sem avançar. Vale dar um toque.`;
    try {
      await sendText(tenant, tenant.owner_whatsapp_e164, text);
      await pool.query(`UPDATE leads SET sla_alerted_at = now() WHERE id = $1`, [r.lead_id]);
      notified++;
    } catch (err) {
      logger.error({ err, leadId: r.lead_id }, "sla: alert failed");
    }
  }
  if (notified) logger.info({ notified }, "sla: breaches alerted");
  return notified;
}
