import { Worker } from "bullmq";
import { bullConnection } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { runDiscovery } from "../discovery/run.js";
import type { DiscoveryJob } from "./queues.js";

// Uma busca por vez: as fontes são APIs públicas — paralelismo aqui vira
// rate-limit/ban. A busca em si já paraleliza o enriquecimento internamente.
const discoveryWorker = new Worker<DiscoveryJob>(
  "discovery",
  async (job) => {
    await runDiscovery(job.data.searchId);
  },
  { ...bullConnection, concurrency: 1 },
);

discoveryWorker.on("ready", () => logger.info("discovery worker ready"));
discoveryWorker.on("failed", (job, err) =>
  logger.error({ err, jobId: job?.id }, "discovery worker job failed"),
);

export { discoveryWorker };
