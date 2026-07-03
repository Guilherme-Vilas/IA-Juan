import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { config } from "../config.js";
import { composeMessage } from "../prospect/compose.js";
import { tickAllCampaigns } from "../prospect/dispatcher.js";
import { scanSlaBreaches } from "../core/sla.js";
import { scanTaskReminders } from "../core/tasks.js";
import { advanceRuns, scanNoReplyAutomations } from "../core/automations.js";
import {
  getCampaignById,
  getProspect,
  logProspectEvent,
  updateProspect,
} from "../prospect/repo.js";
import { whatsappSender } from "../prospect/senders/whatsapp.js";
import { linkedinSender } from "../prospect/senders/linkedin.js";
import { checkSendSuppression } from "../prospect/suppression.js";
import { requireTenantById } from "../core/tenants.js";
import type { ProspectSendJob, ProspectTickJob } from "./queues.js";

// Retry de falha transitória: volta pra 'pending' com backoff; o dispatcher
// re-enfileira respeitando o orçamento do tenant. Após MAX, falha terminal.
const MAX_SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 15 * 60 * 1000;

const sendWorker = new Worker<ProspectSendJob>(
  "prospect-send",
  async (job) => {
    const { campaignId, prospectId } = job.data;
    const [campaign, prospect] = await Promise.all([
      getCampaignById(campaignId),
      getProspect(prospectId),
    ]);
    if (!campaign || !prospect) {
      logger.warn({ campaignId, prospectId }, "prospect-send: campaign or prospect missing");
      return;
    }
    if (prospect.status === "sent" || prospect.status === "replied" || prospect.status === "ready_for_manual" || prospect.status === "opted_out") {
      logger.debug({ prospectId }, "prospect-send: already handled, skip");
      return;
    }

    const tenant = await requireTenantById(campaign.tenant_id);

    // Defesa em profundidade: o estado pode ter mudado entre o import e o envio
    // (opt-out, virou lead, fechou negócio). Re-checa antes de gastar mensagem.
    const suppression = await checkSendSuppression(tenant.id, prospect.external_id, campaign.channel);
    if (suppression) {
      await updateProspect(prospect.id, { status: "skipped", skip_reason: suppression });
      await logProspectEvent(prospect.id, "skipped", { reason: suppression });
      logger.info({ tenant: tenant.slug, prospectId, reason: suppression }, "prospect suprimido no envio");
      return;
    }

    const text = await composeMessage(campaign, prospect);
    await updateProspect(prospect.id, { composed_message: text });
    await logProspectEvent(prospect.id, "composed", { chars: text.length });

    const sender = campaign.channel === "whatsapp" ? whatsappSender : linkedinSender;
    const result = await sender.send(campaign, prospect, text, tenant);

    switch (result.status) {
      case "sent":
        await updateProspect(prospect.id, { status: "sent", sent_at: new Date() });
        await logProspectEvent(prospect.id, "sent");
        logger.info({ tenant: tenant.slug, prospectId, campaignId }, "prospect sent");
        return;
      case "ready_for_manual":
        await updateProspect(prospect.id, { status: "ready_for_manual", sent_at: new Date() });
        await logProspectEvent(prospect.id, "ready_for_manual", { deepLink: result.deepLink });
        logger.info({ tenant: tenant.slug, prospectId, campaignId, deepLink: result.deepLink }, "prospect ready for manual");
        return;
      case "skipped":
        await updateProspect(prospect.id, { status: "skipped", skip_reason: result.reason });
        await logProspectEvent(prospect.id, "skipped", { reason: result.reason });
        logger.info({ tenant: tenant.slug, prospectId, reason: result.reason }, "prospect skipped");
        return;
      case "failed": {
        const attempts = prospect.attempts + 1;
        if (attempts < MAX_SEND_ATTEMPTS) {
          const nextAt = new Date(Date.now() + attempts * RETRY_BACKOFF_MS);
          await updateProspect(prospect.id, {
            status: "pending",
            attempts,
            next_attempt_at: nextAt,
            error_msg: result.error,
          });
          await logProspectEvent(prospect.id, "retry_scheduled", { attempts, nextAt, error: result.error });
          logger.warn({ tenant: tenant.slug, prospectId, attempts, error: result.error }, "prospect failed, retry agendado");
        } else {
          await updateProspect(prospect.id, { status: "failed", attempts, error_msg: result.error });
          await logProspectEvent(prospect.id, "failed", { attempts, error: result.error });
          logger.warn({ tenant: tenant.slug, prospectId, attempts, error: result.error }, "prospect failed (terminal)");
        }
        return;
      }
    }
  },
  { ...bullConnection, concurrency: 1 },
);

sendWorker.on("ready", () => logger.info("prospect-send worker ready"));
sendWorker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "prospect-send worker job failed"),
);

// Tick periódico via repeatable job do BullMQ (substitui setInterval in-process).
// Concorrencia 1 — mesmo com N replicas, o BullMQ entrega 1 job por janela.
const tickWorker = new Worker<ProspectTickJob>(
  "prospect-tick",
  async () => {
    await tickAllCampaigns().catch((err) => logger.error({ err }, "prospect tick fatal"));
    // Reaproveita o tick pra cobrar leads que esfriaram (SLA por etapa)
    // e lembrar tarefas vencidas.
    await scanSlaBreaches().catch((err) => logger.error({ err }, "sla scan fatal"));
    await scanTaskReminders().catch((err) => logger.error({ err }, "task reminder scan fatal"));
    // Motor de automacoes: inicia cadencias de no-reply e avanca os passos vencidos.
    await scanNoReplyAutomations().catch((err) => logger.error({ err }, "automations no_reply scan fatal"));
    await advanceRuns().catch((err) => logger.error({ err }, "automations advance fatal"));
  },
  { ...bullConnection, concurrency: 1 },
);

tickWorker.on("ready", () => logger.info("prospect-tick worker ready"));
tickWorker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "prospect-tick worker job failed"),
);

// `config` ainda usado? mantém import enxuto — PROSPECT_TICK_MS agora é agendado
// no entrypoint de workers (workers.ts) via ensureProspectTickScheduled.
void config;

export { sendWorker, tickWorker };
