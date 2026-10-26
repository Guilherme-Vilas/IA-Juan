import { pool } from "../src/core/db.js";
import { redis } from "../src/core/redis.js";
import { logger } from "../src/core/logger.js";

// Resgate de leads MUDOS por pausa indevida (takeover disparado por replay de
// histórico da Evolution em reconexão do chip — corrigido no webhook, mas quem
// já foi pausado fica mudo até alguém notar).
//
// Critério: lead pausado CUJA ÚLTIMA PALAVRA É DELE (está esperando resposta),
// aberto OU fechado (um lead fechado+pausado fica invisível no board). Ao
// aplicar, despausa E reabre a conversa — o lead volta pro funil.
// Pausa manual legítima normalmente tem o dono respondendo depois — ainda
// assim, rode o dry-run e revise a lista antes de aplicar.
//
//   npx tsx scripts/unpause-stuck-leads.ts                  -> lista (dry-run)
//   npx tsx scripts/unpause-stuck-leads.ts --apply          -> despausa
//   ... --tenant=juan                                       -> só um tenant
const apply = process.argv.includes("--apply");
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] ?? null;

async function run() {
  const { rows } = await pool.query<{
    id: number;
    slug: string;
    wa_id: string;
    nome: string | null;
    source: string | null;
    state: string;
    last_user_at: Date | null;
  }>(
    `SELECT l.id, t.slug, l.wa_id, l.nome, l.source, l.state, l.last_user_at
       FROM leads l JOIN tenants t ON t.id = l.tenant_id
      WHERE l.paused = true
        AND l.is_sandbox = false
        AND l.last_user_at IS NOT NULL
        AND (l.last_assistant_at IS NULL OR l.last_user_at > l.last_assistant_at)
        AND ($1::text IS NULL OR t.slug = $1)
      ORDER BY l.last_user_at DESC`,
    [tenantArg],
  );

  logger.info({ total: rows.length, apply, tenant: tenantArg ?? "todos" }, "leads pausados com mensagem pendente");
  for (const r of rows) {
    logger.info(
      { tenant: r.slug, waId: r.wa_id, nome: r.nome, source: r.source, state: r.state, lastUserAt: r.last_user_at },
      apply ? "despausando" : "candidato (dry-run)",
    );
    if (!apply) continue;
    await pool.query(
      `UPDATE leads
          SET paused = false,
              status = 'open',
              closed_reason = NULL,
              closed_at = NULL,
              state = CASE WHEN state = 'HANDOFF' THEN 'S1_DESCOBERTA' ELSE state END,
              updated_at = now()
        WHERE id = $1`,
      [r.id],
    );
  }
  if (apply && rows.length) {
    logger.info(
      { total: rows.length },
      "despausados. A IA responde na PRÓXIMA mensagem de cada lead — se quiser retomar agora, responda manualmente pelo painel.",
    );
  }
}

run()
  .catch((err) => {
    logger.error({ err }, "unpause: erro");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });
