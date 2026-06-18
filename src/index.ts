// Entrypoint da API HTTP (sem workers — esses rodam em workers.ts).
import Fastify from "fastify";
import { config } from "./config.js";
import { logger } from "./core/logger.js";
import { pool } from "./core/db.js";
import { redis } from "./core/redis.js";
import { registerAuth } from "./auth/plugin.js";
import { registerAuthRoutes } from "./api/auth.js";
import { registerInviteRoutes } from "./api/invites.js";
import { registerRoutes } from "./api/webhook.js";
import { registerSimulatorRoutes } from "./api/simulator.js";
import { registerAdminRoutes } from "./api/admin.js";
import { registerProspectRoutes } from "./api/prospect.js";
import { registerGoogleRoutes } from "./api/google.js";
import { registerSaasRoutes } from "./api/saas.js";
import { registerTenantProvisioningRoutes } from "./api/tenants.js";
import { registerKnowledgeRoutes } from "./api/knowledge.js";

async function main() {
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 });

  // Deep health check — testa Postgres e Redis de verdade.
  app.get("/health", async (_req, reply) => {
    const checks: Record<string, "ok" | "fail"> = { postgres: "fail", redis: "fail" };
    try {
      await pool.query("SELECT 1");
      checks.postgres = "ok";
    } catch (err) {
      logger.error({ err }, "health: postgres check failed");
    }
    try {
      const pong = await redis.ping();
      checks.redis = pong === "PONG" ? "ok" : "fail";
    } catch (err) {
      logger.error({ err }, "health: redis check failed");
    }
    const healthy = Object.values(checks).every((v) => v === "ok");
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", checks });
  });

  // Auth precisa registrar ANTES das rotas que usam app.authenticate.
  await registerAuth(app);
  await registerAuthRoutes(app);
  await registerInviteRoutes(app);

  await registerRoutes(app);
  await registerSimulatorRoutes(app);
  await registerTenantProvisioningRoutes(app);
  await registerAdminRoutes(app);
  await registerProspectRoutes(app);
  await registerGoogleRoutes(app);
  await registerSaasRoutes(app);
  await registerKnowledgeRoutes(app);

  await app.listen({ host: "0.0.0.0", port: config.PORT });
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      simulator: config.SIMULATOR_MODE,
      webhook: `${config.PUBLIC_BASE_URL}/webhook/evolution`,
    },
    "api up",
  );

  const shutdown = async (sig: string) => {
    logger.info({ sig }, "api shutting down");
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
