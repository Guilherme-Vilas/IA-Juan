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

// Follow-up stage 1: tom mais profissional, sem "opa". Convite curto e direto.
const MSG_STAGE_1 = "Oi! Conseguiu ver a mensagem? Fico no aguardo do seu retorno 🙌";
// Follow-up stage 2: convidar a retomar AGORA, sem oferecer "procurar depois"
// (evita dar pretexto pra postergar — fica sempre como "aberto no aguardo").
const MSG_STAGE_2 =
  "Oi! Tudo bem? Aproveitando que estou online, conseguimos seguir agora pra eu te apresentar as opções?";

async function pushHistoryAssistant(tenantSlug: string, waId: string, content: string) {
  const k = keys.leadHistory(tenantSlug, waId);
  await redis.rpush(k, JSON.stringify({ role: "assistant", content }));
  await redis.ltrim(k, -16, -1);
  await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
}

function shouldFire(lead: {
  status: string;
  paused: boolean;
  last_user_at: Date | null;
  last_assistant_at: Date | null;
}): boolean {
  if (lead.status !== "open") return false;
  if (lead.paused) return false;
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

    if (stage === 1) {
      await sendText(tenant, waId, MSG_STAGE_1);
      await logMessage(lead.id, "out", "assistant", MSG_STAGE_1);
      await pushHistoryAssistant(tenant.slug, waId, MSG_STAGE_1);
      await markLastActivity(tenantId, waId, "assistant");
      await scheduleFollowup(tenantId, waId, 2, config.FOLLOWUP_2_MS);
      logger.info({ tenant: tenant.slug, waId }, "followup 1 sent; stage 2 scheduled");
      return;
    }

    if (stage === 2) {
      await sendText(tenant, waId, MSG_STAGE_2);
      await logMessage(lead.id, "out", "assistant", MSG_STAGE_2);
      await pushHistoryAssistant(tenant.slug, waId, MSG_STAGE_2);
      await markLastActivity(tenantId, waId, "assistant");
      await scheduleFollowup(tenantId, waId, 3, config.FOLLOWUP_CLOSE_MS);
      logger.info({ tenant: tenant.slug, waId }, "followup 2 sent; stage 3 (auto-close) scheduled");
      return;
    }

    if (stage === 3) {
      await closeConversation(tenantId, waId, "no_response");
      logger.info({ tenant: tenant.slug, waId }, "conversation auto-closed: no_response");
    }
  },
  { ...bullConnection, concurrency: 8 },
);

worker.on("ready", () => logger.info("followup worker ready"));
worker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "followup worker job failed"),
);

export { followupQueue };
