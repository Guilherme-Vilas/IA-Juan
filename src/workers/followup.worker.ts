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

const MSG_STAGE_1 = "Opa, conseguiu ver a mensagem? 👀";
const MSG_STAGE_2 = "Oi! Só pra não te deixar sem resposta: ainda faz sentido a gente seguir essa conversa, ou prefere que eu te procure mais pra frente?";

async function pushHistoryAssistant(waId: string, content: string) {
  const k = keys.leadHistory(waId);
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
  // só dispara se a última mensagem foi da assistente (user não respondeu)
  return la > lu;
}

const worker = new Worker<FollowupJob>(
  "followup",
  async (job) => {
    const { waId, stage } = job.data;
    const lead = await getLead(waId);
    if (!lead) {
      logger.debug({ waId }, "followup: lead not found; skip");
      return;
    }
    if (!shouldFire(lead)) {
      logger.info({ waId, stage }, "followup: skip (lead replied or closed)");
      return;
    }

    if (stage === 1) {
      await sendText(waId, MSG_STAGE_1);
      await logMessage(lead.id, "out", "assistant", MSG_STAGE_1);
      await pushHistoryAssistant(waId, MSG_STAGE_1);
      await markLastActivity(waId, "assistant");
      await scheduleFollowup(waId, 2, config.FOLLOWUP_2_MS);
      logger.info({ waId }, "followup 1 sent; stage 2 scheduled");
      return;
    }

    if (stage === 2) {
      await sendText(waId, MSG_STAGE_2);
      await logMessage(lead.id, "out", "assistant", MSG_STAGE_2);
      await pushHistoryAssistant(waId, MSG_STAGE_2);
      await markLastActivity(waId, "assistant");
      await scheduleFollowup(waId, 3, config.FOLLOWUP_CLOSE_MS);
      logger.info({ waId }, "followup 2 sent; stage 3 (auto-close) scheduled");
      return;
    }

    if (stage === 3) {
      await closeConversation(waId, "no_response");
      logger.info({ waId }, "conversation auto-closed: no_response");
    }
  },
  { ...bullConnection, concurrency: 8 },
);

worker.on("ready", () => logger.info("followup worker ready"));
worker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "followup worker job failed"),
);

export { followupQueue };
