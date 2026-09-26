import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { sendText } from "../core/evolution.js";
import {
  closeConversation,
  getLead,
  logMessage,
  markLastActivity,
} from "../core/db.js";
import { redis, keys } from "../core/redis.js";
import { followupQueue, scheduleFollowup, type FollowupJob } from "./queues.js";
import { requireTenantById } from "../core/tenants.js";
import { getFollowupConfig, msUntilWorkWindow, renderFollowupText } from "../core/followups.js";
import { isWhatsappConnected } from "../core/connection-monitor.js";

// Follow-up de conversa (lead sumiu depois da IA falar). Os toques, textos e
// tempos vêm da configuração do TENANT (tenant_followups) — ver core/followups.ts.
// stage N = índice do toque (1-based); stage steps.length+1 = fechamento.

async function pushHistoryAssistant(tenantSlug: string, waId: string, content: string) {
  const k = keys.leadHistory(tenantSlug, waId);
  await redis.rpush(k, JSON.stringify({ role: "assistant", content }));
  await redis.ltrim(k, -16, -1);
  await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
}

function shouldFire(lead: {
  status: string;
  state: string;
  paused: boolean;
  last_user_at: Date | null;
  last_assistant_at: Date | null;
}): boolean {
  if (lead.status !== "open") return false;
  if (lead.paused) return false;
  // Já agendou (S5) ou foi pra humano (HANDOFF) → nada de follow-up de "sumiço".
  if (lead.state === "S5_CONFIRMADO" || lead.state === "HANDOFF") return false;
  const lu = lead.last_user_at ? new Date(lead.last_user_at).getTime() : 0;
  const la = lead.last_assistant_at ? new Date(lead.last_assistant_at).getTime() : 0;
  return la > lu;
}

const worker = new Worker<FollowupJob>(
  "followup",
  async (job) => {
    const { tenantId, waId, stage } = job.data;
    const tenant = await requireTenantById(tenantId);

    const lead = await getLead(tenantId, waId);
    if (!lead) {
      logger.debug({ tenant: tenant.slug, waId }, "followup: lead not found; skip");
      return;
    }
    if (!shouldFire(lead)) {
      logger.info({ tenant: tenant.slug, waId, stage }, "followup: skip (lead replied or closed)");
      return;
    }

    const cfg = await getFollowupConfig(tenantId);
    if (!cfg.enabled) {
      logger.debug({ tenant: tenant.slug, waId }, "followup: desabilitado pro tenant; skip");
      return;
    }

    // Depois do último toque, só resta o fechamento automático.
    if (stage > cfg.steps.length) {
      await closeConversation(tenantId, waId, "no_response");
      logger.info({ tenant: tenant.slug, waId }, "conversation auto-closed: no_response");
      return;
    }

    // Fora do horário comercial do tenant: reagenda pro início da janela —
    // follow-up de madrugada queima a marca (e o chip).
    if (cfg.work_hours_only) {
      const wait = msUntilWorkWindow(tenant);
      if (wait > 0) {
        await scheduleFollowup(tenantId, waId, stage, wait);
        logger.debug({ tenant: tenant.slug, waId, stage, waitMin: Math.round(wait / 60000) }, "followup: fora da janela — reagendado");
        return;
      }
    }

    // Chip caído: reagenda sem consumir o toque.
    if (!(await isWhatsappConnected(tenant))) {
      await scheduleFollowup(tenantId, waId, stage, 30 * 60_000);
      logger.warn({ tenant: tenant.slug, waId, stage }, "followup: WhatsApp desconectado — reagendado +30min");
      return;
    }

    const text = renderFollowupText(cfg.steps[stage - 1]!.text, lead);
    await sendText(tenant, waId, text);
    await logMessage(lead.id, "out", "assistant", text);
    await pushHistoryAssistant(tenant.slug, waId, text);
    await markLastActivity(tenantId, waId, "assistant");

    const next = stage + 1;
    const delayMs =
      next <= cfg.steps.length ? cfg.steps[next - 1]!.delay_minutes * 60_000 : cfg.close_after_minutes * 60_000;
    await scheduleFollowup(tenantId, waId, next, delayMs);
    logger.info({ tenant: tenant.slug, waId, stage, next }, "followup enviado; próximo agendado");
  },
  { ...bullConnection, concurrency: 8 },
);

worker.on("ready", () => logger.info("followup worker ready"));
worker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "followup worker job failed"),
);

export { followupQueue };
