import { pool } from "../src/core/db.js";
import { redis } from "../src/core/redis.js";
import { logger } from "../src/core/logger.js";

// ⚠️ RESET OPERACIONAL DE UM TENANT — apaga DE VERDADE (sem volta):
//   leads (+ conversas, agendamentos, tarefas, notas, histórico de etapas,
//   execuções de automação), campanhas (+ contatos, cadência, envios),
//   buscas do discovery, e a memória Redis correspondente.
//
// PRESERVA: tenants, usuários, prompts (+versões), configurações do agente,
// pipeline/etapas, automações (as regras), follow-up config, base de
// conhecimento, imóveis, webhooks, treinamentos e — por padrão — a BLACKLIST
// (quem pediu pra nunca mais receber mensagem continua protegido: LGPD).
//
// Uso (sempre por tenant — "o banco inteiro" levaria os OUTROS clientes junto):
//   npx tsx scripts/reset-tenant-data.ts --tenant=juan                 -> dry-run (só conta)
//   npx tsx scripts/reset-tenant-data.ts --tenant=juan --apply         -> apaga
//   ... --apply --include-blacklist   -> apaga TAMBÉM os opt-outs (não recomendado)
//
// Antes de aplicar, faça um dump manual:
//   docker compose -f docker-compose.prod.yml exec db-backup sh -c \
//     'pg_dumpall -h postgres -U ia | gzip > /backups/pre-reset-$(date +%s).sql.gz'

const apply = process.argv.includes("--apply");
const includeBlacklist = process.argv.includes("--include-blacklist");
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] ?? null;

async function run() {
  if (!tenantArg) {
    logger.error("obrigatório: --tenant=<slug> (ex: --tenant=juan). Não existe modo 'todos' de propósito.");
    process.exitCode = 1;
    return;
  }
  const t = await pool.query<{ id: number; slug: string; name: string }>(
    `SELECT id, slug, name FROM tenants WHERE slug = $1`,
    [tenantArg],
  );
  const tenant = t.rows[0];
  if (!tenant) {
    logger.error({ tenant: tenantArg }, "tenant não encontrado");
    process.exitCode = 1;
    return;
  }

  // Contagens — o dry-run é isto; o apply mostra o mesmo antes de apagar.
  const counts: Record<string, number> = {};
  const countQueries: Array<[string, string]> = [
    ["leads", `SELECT count(*) FROM leads WHERE tenant_id = $1`],
    ["mensagens", `SELECT count(*) FROM messages m JOIN leads l ON l.id = m.lead_id WHERE l.tenant_id = $1`],
    ["agendamentos", `SELECT count(*) FROM appointments WHERE tenant_id = $1`],
    ["campanhas", `SELECT count(*) FROM campaigns WHERE tenant_id = $1`],
    ["prospects", `SELECT count(*) FROM prospects WHERE tenant_id = $1`],
    ["envios de campanha", `SELECT count(*) FROM prospect_sends WHERE tenant_id = $1`],
    ["execuções de automação", `SELECT count(*) FROM automation_runs WHERE tenant_id = $1`],
    ["buscas discovery", `SELECT count(*) FROM discovery_searches WHERE tenant_id = $1`],
    ["blacklist (opt-outs)", `SELECT count(*) FROM prospect_blacklist WHERE tenant_id = $1`],
  ];
  for (const [label, q] of countQueries) {
    counts[label] = Number((await pool.query<{ count: string }>(q, [tenant.id])).rows[0]?.count ?? 0);
  }
  logger.info({ tenant: tenant.slug, nome: tenant.name, ...counts }, apply ? "VAI APAGAR" : "dry-run (nada apagado)");

  if (!apply) {
    logger.info("pra executar: adicione --apply (e faça o dump antes!)");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Ordem: filhos sem CASCade primeiro; o resto cascateia de leads/campaigns.
    await client.query(
      `DELETE FROM messages WHERE lead_id IN (SELECT id FROM leads WHERE tenant_id = $1)`,
      [tenant.id],
    );
    await client.query(`DELETE FROM automation_runs WHERE tenant_id = $1`, [tenant.id]);
    await client.query(`DELETE FROM leads WHERE tenant_id = $1`, [tenant.id]); // cascateia appointments, tasks, notes, stage_events
    await client.query(`DELETE FROM campaigns WHERE tenant_id = $1`, [tenant.id]); // cascateia prospects, steps, sends, events
    await client.query(`DELETE FROM discovery_searches WHERE tenant_id = $1`, [tenant.id]); // cascateia discovered_leads
    if (includeBlacklist) {
      await client.query(`DELETE FROM prospect_blacklist WHERE tenant_id = $1`, [tenant.id]);
      logger.warn("blacklist APAGADA — contatos que pediram opt-out podem voltar a ser prospectados");
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  // Memória Redis do tenant: histórico/estado de conversa, dedupe, ecos,
  // marcas de campanha e locks. (waconn/wastate ficam — é estado do chip.)
  const patterns = [
    `lead:${tenant.slug}:*`,
    `echo:${tenant.slug}:*`,
    `campaign_reply:${tenant.slug}:*`,
    `dedupe:msg:${tenant.id}:*`,
    `lock:turn:${tenant.id}:*`,
    `llm:usage:${tenant.slug}:*`,
  ];
  let cleared = 0;
  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
      cursor = next;
      if (keys.length) {
        await redis.del(...keys);
        cleared += keys.length;
      }
    } while (cursor !== "0");
  }

  logger.info({ tenant: tenant.slug, redisKeys: cleared }, "reset concluído — tenant zerado pra recomeçar");
  logger.info("próximos passos: reimportar listas nas campanhas novas; prompts/configurações/pipeline ficaram intactos.");
}

run()
  .catch((err) => {
    logger.error({ err }, "reset: erro (transação revertida, nada parcial)");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });
