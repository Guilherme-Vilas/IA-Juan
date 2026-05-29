import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { config } from "../config.js";
import { composeMessage } from "../prospect/compose.js";
import { tickAllCampaigns } from "../prospect/dispatcher.js";
import {
  getCampaignById,
  getProspect,
  logProspectEvent,
  updateProspect,
} from "../prospect/repo.js";
import { whatsappSender } from "../prospect/senders/whatsapp.js";
import { linkedinSender } from "../prospect/senders/linkedin.js";
import { requireTenantById } from "../core/tenants.js";
import type { ProspectSendJob } from "./queues.js";

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
    if (prospect.status === "sent" || prospect.status === "replied" || prospect.status === "ready_for_manual") {
      logger.debug({ prospectId }, "prospect-send: already handled, skip");
      return;
    }

    const tenant = await requireTenantById(campaign.tenant_id);

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
      case "failed":
        await updateProspect(prospect.id, { status: "failed", error_msg: result.error });
        await logProspectEvent(prospect.id, "failed", { error: result.error });
        logger.warn({ tenant: tenant.slug, prospectId, error: result.error }, "prospect failed");
        return;
    }
  },
  { ...bullConnection, concurrency: 1 },
);

sendWorker.on("ready", () => logger.info("prospect-send worker ready"));
sendWorker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "prospect-send worker job failed"),
);

// Tick periódico — varre todas as campanhas em running (qualquer tenant) e enfileira.
let tickInterval: NodeJS.Timeout | null = null;

function startTicker() {
  if (tickInterval) return;
  const intervalMs = config.PROSPECT_TICK_MS;
  tickInterval = setInterval(() => {
    void tickAllCampaigns().catch((err) =>
      logger.error({ err }, "prospect tick fatal"),
    );
  }, intervalMs);
  logger.info({ intervalMs }, "prospect ticker started");
}

startTicker();

export { sendWorker };
