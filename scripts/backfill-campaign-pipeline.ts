import { pool } from "../src/core/db.js";
import { redis } from "../src/core/redis.js";
import { logger } from "../src/core/logger.js";
import { ensureLeadOnPipeline } from "../src/core/pipeline.js";

// Coloca na pipeline os leads que RESPONDERAM campanha e ficaram sem etapa
// (antes do handoff registrar no CRM). Quem só recebeu a campanha fica de fora.
//
//   npx tsx scripts/backfill-campaign-pipeline.ts            -> dry-run (só lista)
//   npx tsx scripts/backfill-campaign-pipeline.ts --apply    -> aplica
//   ... --tenant=juan                                        -> só um tenant
const apply = process.argv.includes("--apply");
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] ?? null;

async function run() {
  const { rows } = await pool.query<{
    tenant_id: number;
    slug: string;
    lead_id: number;
    wa_id: string;
    campaign_id: number;
    campaign_name: string | null;
  }>(
    `SELECT DISTINCT ON (l.id)
            l.tenant_id, t.slug, l.id AS lead_id, l.wa_id, p.campaign_id, c.name AS campaign_name
       FROM prospects p
       JOIN leads l ON l.id = p.lead_id
       JOIN tenants t ON t.id = l.tenant_id
       LEFT JOIN campaigns c ON c.id = p.campaign_id
      WHERE p.replied_at IS NOT NULL
        AND l.pipeline_stage_id IS NULL
        AND ($1::text IS NULL OR t.slug = $1)
      ORDER BY l.id, p.replied_at DESC`,
    [tenantArg],
  );

  logger.info({ total: rows.length, apply, tenant: tenantArg ?? "todos" }, "backfill: leads de campanha sem etapa");
  let done = 0;
  for (const r of rows) {
    if (!apply) {
      logger.info({ tenant: r.slug, waId: r.wa_id, campaign: r.campaign_name }, "backfill (dry-run)");
      continue;
    }
    try {
      await pool.query(
        `UPDATE leads SET source_detail = source_detail || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ campaign_id: r.campaign_id, campaign_name: r.campaign_name }), r.lead_id],
      );
      await ensureLeadOnPipeline(r.tenant_id, r.lead_id, {
        reason: r.campaign_name ? `respondeu campanha: ${r.campaign_name}` : "respondeu campanha",
        silent: true, // nao dispara automacoes de etapa em lead antigo
      });
      done++;
    } catch (err) {
      logger.warn({ err, tenant: r.slug, waId: r.wa_id }, "backfill: falhou");
    }
  }
  logger.info({ done, total: rows.length, apply }, "backfill: fim");
}

run()
  .catch((err) => {
    logger.error({ err }, "backfill: erro");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });
