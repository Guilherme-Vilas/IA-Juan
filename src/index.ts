import Fastify from "fastify";
import { config } from "./config.js";
import { logger } from "./core/logger.js";
import { registerRoutes } from "./api/webhook.js";
import { registerSimulatorRoutes } from "./api/simulator.js";
import { registerAdminRoutes } from "./api/admin.js";
import { registerProspectRoutes } from "./api/prospect.js";
import { registerGoogleRoutes } from "./api/google.js";

async function main() {
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 });
  await registerRoutes(app);
  await registerSimulatorRoutes(app);
  await registerAdminRoutes(app);
  await registerProspectRoutes(app);
  await registerGoogleRoutes(app);

  await app.listen({ host: "0.0.0.0", port: config.PORT });
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      simulator: config.SIMULATOR_MODE,
      webhook: `${config.PUBLIC_BASE_URL}/webhook/evolution`,
      simUI: `${config.PUBLIC_BASE_URL}/`,
    },
    "api up",
  );

  await import("./workers/inbound.worker.js");
  await import("./workers/followup.worker.js");
  await import("./workers/prospect.worker.js");
  await import("./workers/retry.worker.js");
  logger.info("workers attached");

  const shutdown = async (sig: string) => {
    logger.info({ sig }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
