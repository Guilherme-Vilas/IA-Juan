import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { runMarketingSend } from "../api/marketing.js";
import type { MarketingJob } from "./queues.js";

// Uma campanha por vez — o envio já tem ritmo interno (~90 e-mails/min).
const marketingWorker = new Worker<MarketingJob>(
  "marketing",
  async (job) => {
    await runMarketingSend(job.data.campaignId);
  },
  { ...bullConnection, concurrency: 1 },
);

marketingWorker.on("ready", () => logger.info("marketing worker ready"));
marketingWorker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "marketing worker job failed"),
);

export { marketingWorker };
