import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { drainBuffer } from "./buffer.js";
import { runTurn } from "../sdr/fsm.js";
import { sendText, sendPresence } from "../core/evolution.js";
import { logger } from "../core/logger.js";
import { config } from "../config.js";
import { getLead, logMessage, markLastActivity } from "../core/db.js";
import { splitForWhatsApp, typingDelayMs, sleep } from "./chunk.js";
import { cancelFollowups, scheduleFollowup, type InboundJob } from "./queues.js";
import { requireTenantById, type TenantRow } from "../core/tenants.js";

async function sendReplyAsChunks(tenant: TenantRow, waId: string, leadId: number, fullText: string) {
  const chunks = splitForWhatsApp(fullText);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    try {
      await sendPresence(tenant, waId, "composing").catch(() => undefined);
      await sleep(typingDelayMs(chunk));
      await logMessage(leadId, "out", "assistant", chunk);
      await sendText(tenant, waId, chunk);
    } catch (err) {
      logger.error({ err, tenant: tenant.slug, waId, chunkIndex: i }, "chunk send failed");
    }
  }
  await markLastActivity(tenant.id, waId, "assistant").catch(() => undefined);
}

const worker = new Worker<InboundJob>(
  "inbound",
  async (job) => {
    const { tenantId, waId, pushName } = job.data;
    const tenant = await requireTenantById(tenantId);

    const text = await drainBuffer(tenant.slug, waId);
    if (!text) {
      logger.debug({ tenant: tenant.slug, waId }, "empty buffer after debounce; skip");
      return;
    }

    // lead respondeu → cancela qualquer follow-up pendente
    await cancelFollowups(tenantId, waId);

    await sendPresence(tenant, waId, "composing").catch(() => undefined);

    try {
      const result = await runTurn(tenant, waId, text, pushName);
      const lead = await getLead(tenantId, waId);

      if (result.replyText && lead) {
        await sendReplyAsChunks(tenant, waId, lead.id, result.replyText);
        logger.info(
          { tenant: tenant.slug, waId, state: result.newState, chars: result.replyText.length },
          "turn.sent",
        );
      } else {
        logger.info({ tenant: tenant.slug, waId, state: result.newState }, "turn.no-reply");
      }

      // se a conversa ficou aberta e a IA respondeu → agenda follow-up 1
      if (result.replyText && !result.closedReason) {
        await scheduleFollowup(tenantId, waId, 1, config.FOLLOWUP_1_MS);
        logger.debug({ tenant: tenant.slug, waId }, "followup stage 1 scheduled");
      }
    } catch (err) {
      logger.error({ err, tenant: tenant.slug, waId }, "worker.turn failed");
      const lead = await getLead(tenantId, waId);
      const fallback = "Opa, tive um probleminha técnico aqui 😅 Pode repetir, por favor?";
      if (lead) {
        await logMessage(lead.id, "out", "assistant", fallback).catch(() => undefined);
      }
      await sendText(tenant, waId, fallback).catch(() => undefined);
    } finally {
      await sendPresence(tenant, waId, "paused").catch(() => undefined);
    }
  },
  { ...bullConnection, concurrency: 4 },
);

worker.on("ready", () => logger.info("inbound worker ready"));
worker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "inbound worker job failed"),
);
