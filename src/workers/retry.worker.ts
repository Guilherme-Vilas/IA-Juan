import { Worker } from "bullmq";
import { bullConnection, redis } from "../core/redis.js";
import { runTurn } from "../sdr/fsm.js";
import { sendText, sendPresence } from "../core/evolution.js";
import { logger } from "../core/logger.js";
import { config } from "../config.js";
import { getLead, logMessage, markLastActivity } from "../core/db.js";
import { splitForWhatsApp, typingDelayMs, sleep } from "./chunk.js";
import {
  retryTurnQueue,
  retryTurnJobId,
  scheduleFollowup,
  scheduleFirstFollowup,
  type RetryTurnJob,
} from "./queues.js";
import { requireTenantById, type TenantRow } from "../core/tenants.js";

async function sendReplyAsChunks(
  tenant: TenantRow,
  waId: string,
  leadId: number,
  fullText: string,
) {
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

// Consome retry-turn: re-roda runTurn() em "modo retry" (sem repushar o user
// message; usando o histórico que já tem a msg pendente).
// - sucesso: envia a resposta real prefixada por "Voltei!" e segue normal.
// - falha de novo: runTurn marca retryAfterMs com delay maior; agendamos o
//   próximo. Após 3 tentativas runTurn faz handoff sozinho.
const worker = new Worker<RetryTurnJob>(
  "retry-turn",
  async (job) => {
    const { tenantId, waId, attempt } = job.data;
    const tenant = await requireTenantById(tenantId);
    logger.info({ tenant: tenant.slug, waId, attempt }, "retry-turn: starting");

    await sendPresence(tenant, waId, "composing").catch(() => undefined);

    // Trava por lead compartilhada com o inbound: se um turno normal está
    // rodando (lead voltou a falar), o retry espera 5s e tenta de novo.
    const lockKey = `lock:turn:${tenantId}:${waId}`;
    const locked = await redis.set(lockKey, "1", "EX", 120, "NX").catch(() => "OK" as const);
    if (locked !== "OK") {
      await retryTurnQueue.add(
        "retry",
        job.data,
        { jobId: `${job.id}:wait:${Date.now()}`, delay: 5000, removeOnComplete: true, removeOnFail: 20 },
      );
      return;
    }

    try {
      // userText vazio — runTurn em modo retry usa o histórico
      const result = await runTurn(tenant, waId, "", undefined, { attempt });
      const lead = await getLead(tenantId, waId);

      if (result.replyText && lead) {
        await sendReplyAsChunks(tenant, waId, lead.id, result.replyText);
        logger.info(
          { tenant: tenant.slug, waId, attempt, chars: result.replyText.length, retried: true },
          "retry-turn: sent",
        );
      } else {
        logger.info({ tenant: tenant.slug, waId, attempt }, "retry-turn: no reply produced");
      }

      // Se DE NOVO falhou (retryAfterMs presente), agenda próxima tentativa
      if (result.retryAfterMs && result.attemptUsed) {
        const jobId = retryTurnJobId(tenantId, waId, result.attemptUsed);
        await retryTurnQueue
          .add(
            "retry",
            { tenantId, waId, attempt: result.attemptUsed },
            { jobId, delay: result.retryAfterMs, removeOnComplete: true, removeOnFail: 50 },
          )
          .catch((err) => {
            if (!String(err?.message ?? "").includes("already exists")) {
              logger.error({ err, tenant: tenant.slug, waId }, "failed to re-enqueue retry-turn");
            }
          });
        logger.warn(
          { tenant: tenant.slug, waId, attempt: result.attemptUsed, delayMs: result.retryAfterMs },
          "retry-turn: scheduled another retry",
        );
        return;
      }

      // Sucesso final → agenda follow-up normal se conversa segue aberta
      // (mesma regra do inbound: nada de follow-up em estado terminal).
      const TERMINAL_STATES = ["S5_CONFIRMADO", "HANDOFF"];
      if (result.replyText && !result.closedReason && !TERMINAL_STATES.includes(result.newState)) {
        await scheduleFirstFollowup(tenantId, waId);
      }
    } catch (err) {
      logger.error({ err, tenant: tenant.slug, waId, attempt }, "retry-turn worker fatal");
    } finally {
      await redis.del(lockKey).catch(() => undefined);
      await sendPresence(tenant, waId, "paused").catch(() => undefined);
    }
  },
  { ...bullConnection, concurrency: 2 },
);

worker.on("ready", () => logger.info("retry-turn worker ready"));
worker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "retry-turn worker job failed"),
);
