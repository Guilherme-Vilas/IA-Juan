import type { FastifyInstance } from "fastify";
import { pool } from "../core/db.js";
import { redis } from "../core/redis.js";
import { config } from "../config.js";
import { listTenants } from "../core/tenants.js";
import { getLlmUsageToday } from "../core/llm-budget.js";
import { requireSuperadmin } from "../auth/plugin.js";
import {
  inboundQueue,
  followupQueue,
  retryTurnQueue,
  prospectSendQueue,
} from "../workers/queues.js";
import { webhookQueue } from "../core/outbound-webhooks.js";

// Saúde da plataforma num relance (superadmin): chip por tenant, consumo de
// LLM, leads esperando resposta e filas — pra descobrir problema ANTES do
// cliente ligar bravo. Nada aqui chama a Evolution (só Redis/Postgres): barato
// o bastante pra polling de 30s.

export async function registerPlatformHealthRoutes(app: FastifyInstance) {
  app.get("/admin/platform/health", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!requireSuperadmin(req, reply)) return;

    const tenants = (await listTenants()).filter((t) => t.active && t.slug !== config.DEMO_TENANT_SLUG);

    // Leads abertos esperando resposta há 15+ min (a IA deveria ter respondido).
    const waiting = await pool.query<{ tenant_id: number; n: string }>(
      `SELECT tenant_id, COUNT(*)::text AS n FROM leads
        WHERE status = 'open' AND paused = false AND is_sandbox = false
          AND last_user_at IS NOT NULL
          AND (last_assistant_at IS NULL OR last_user_at > last_assistant_at)
          AND last_user_at < now() - interval '15 minutes'
        GROUP BY tenant_id`,
    );
    const waitingMap = new Map(waiting.rows.map((r) => [r.tenant_id, Number(r.n)]));

    const perTenant = await Promise.all(
      tenants.map(async (t) => {
        const [waEvents, waCache, llmUsed] = await Promise.all([
          redis.get(`waconn:${t.id}`).catch(() => null),
          redis.get(`wastate:${t.id}`).catch(() => null),
          getLlmUsageToday(t.slug),
        ]);
        return {
          slug: t.slug,
          name: t.name,
          whatsapp: waEvents ?? waCache ?? "unknown",
          llm_used_today: llmUsed,
          llm_cap: config.LLM_DAILY_TOKENS_PER_TENANT,
          leads_waiting: waitingMap.get(t.id) ?? 0,
        };
      }),
    );

    const queues = await Promise.all(
      (
        [
          ["inbound", inboundQueue],
          ["followup", followupQueue],
          ["retry-turn", retryTurnQueue],
          ["prospect-send", prospectSendQueue],
          ["webhook-deliver", webhookQueue],
        ] as const
      ).map(async ([name, q]) => {
        const c = await q
          .getJobCounts("waiting", "active", "delayed", "failed")
          .catch(() => ({ waiting: -1, active: -1, delayed: -1, failed: -1 }));
        return { name, ...c };
      }),
    );

    return { tenants: perTenant, queues, generated_at: new Date().toISOString() };
  });
}
