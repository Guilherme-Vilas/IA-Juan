import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import { redis } from "../core/redis.js";
import { requireTenantById } from "../core/tenants.js";
import { getConnectionState, connectInstance, setInstanceWebhook } from "../core/evolution.js";

// Saúde da conexão WhatsApp por tenant + reconexão via QR SEM sair do painel.
// O status alimenta o alerta vermelho global; o QR alimenta o modal de reconexão.

export async function registerWhatsappRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    // Estado da conexão — cache curto no Redis (muitos navegadores fazem polling).
    scope.get("/admin/tenants/:slug/whatsapp/status", async (req) => {
      const cacheKey = `wastate:${req.tenantId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return { state: cached, connected: cached === "open" };

      const tenant = await requireTenantById(req.tenantId!);
      const state = await getConnectionState(tenant);
      await redis.set(cacheKey, state, "EX", 20);
      return { state, connected: state === "open" };
    });

    // QR code de reconexão (o mesmo que o Evolution Manager mostraria).
    scope.post("/admin/tenants/:slug/whatsapp/qr", async (req, reply) => {
      const tenant = await requireTenantById(req.tenantId!);
      // garante o webhook configurado (reconexões antigas às vezes o perdem)
      await setInstanceWebhook(tenant.evolution_instance).catch(() => undefined);
      const qr = await connectInstance(tenant.evolution_instance);
      // estado pode mudar já — derruba o cache pro polling pegar rápido
      await redis.del(`wastate:${req.tenantId}`).catch(() => undefined);
      if (!qr?.base64 && !qr?.code) {
        return reply.code(502).send({
          error: "não consegui gerar o QR agora — se persistir, a instância pode precisar de reprovisionamento (fale com o suporte)",
        });
      }
      logger.info({ tenant: req.tenantSlug }, "whatsapp: QR de reconexão gerado no painel");
      return reply.send({ qr_base64: qr.base64 ?? null, pairing_code: qr.code ?? null });
    });
  });
}
