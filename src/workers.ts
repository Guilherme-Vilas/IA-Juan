// Entrypoint dos WORKERS (processo separado da API).
// Sobe os consumidores de fila BullMQ e agenda o repeatable job de prospeccao.
// Rodar com: `node dist/workers.js` (prod) ou `tsx src/workers.ts` (dev).
//
// Beneficio SRE: API (index.ts) e processamento (este arquivo) escalam e falham
// de forma independente. Um worker travado nao derruba o webhook HTTP.
import { config } from "./config.js";
import { logger } from "./core/logger.js";
import { ensureProspectTickScheduled } from "./workers/queues.js";

async function main() {
  // Importa os modulos de worker — cada um instancia seu BullMQ Worker no load.
  await import("./workers/inbound.worker.js");
  await import("./workers/followup.worker.js");
  await import("./workers/prospect.worker.js");
  await import("./workers/retry.worker.js");

  // Agenda o tick de prospeccao como repeatable job (idempotente entre replicas).
  await ensureProspectTickScheduled(config.PROSPECT_TICK_MS);

  logger.info(
    { intervalMs: config.PROSPECT_TICK_MS },
    "workers up (inbound, followup, prospect-send, prospect-tick, retry)",
  );

  const shutdown = (sig: string) => {
    logger.info({ sig }, "workers shutting down");
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "workers fatal");
  process.exit(1);
});
