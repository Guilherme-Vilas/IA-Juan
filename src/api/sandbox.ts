import type { FastifyInstance } from "fastify";
import { pool, getLead, listMessages, resetLead, upsertLead } from "../core/db.js";
import { redis, keys } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { runTurn } from "../sdr/fsm.js";
import { requireTenantById } from "../core/tenants.js";
import { rateLimit } from "../core/rate-limit.js";

// "Testar IA" no painel: conversa sandbox por usuário, com o MESMO runTurn de
// produção (prompt salvo, RAG, tools, FSM) — mas nada sai pro mundo: sem
// WhatsApp, sem CRM, sem automações, sem agenda real (runTurn sandbox=true).
// O lead sandbox fica marcado (is_sandbox) e é filtrado de todas as leituras.

function sandboxWaId(req: { auth?: { kind: string; userId?: number } }): string {
  return req.auth?.kind === "user" ? `sandbox-u${req.auth.userId}` : "sandbox-service";
}

async function clearSandboxRedis(tenantSlug: string, waId: string): Promise<void> {
  await Promise.all(
    [
      keys.leadHistory(tenantSlug, waId),
      keys.leadState(tenantSlug, waId),
      keys.leadSlots(tenantSlug, waId),
      keys.offeredSlots(tenantSlug, waId),
      keys.debounceBuffer(tenantSlug, waId),
    ].map((k) => redis.del(k).catch(() => undefined)),
  );
}

export async function registerSandboxRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    // Estado atual da conversa de teste (continuidade entre aberturas do painel).
    scope.get("/admin/tenants/:slug/sandbox", async (req) => {
      const waId = sandboxWaId(req);
      const lead = await getLead(req.tenantId!, waId);
      if (!lead) return { lead: null, messages: [] };
      const messages = await listMessages(lead.id, 0, 50);
      return {
        lead: { state: lead.state, slots: lead.slots, status: lead.status, closed_reason: lead.closed_reason },
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
    });

    // Um turno de conversa: texto do testador → resposta da IA.
    scope.post("/admin/tenants/:slug/sandbox/message", async (req, reply) => {
      const body = req.body as { text?: string };
      const text = (body?.text ?? "").trim().slice(0, 2000);
      if (!text) return reply.code(400).send({ error: "texto obrigatório" });

      // Custa LLM de verdade: limite generoso mas finito por usuário.
      const rl = await rateLimit(`sandbox:${req.tenantId}:${sandboxWaId(req)}`, 60, 3600);
      if (!rl.allowed) return reply.code(429).send({ error: "limite de testes por hora atingido — volte em instantes" });

      const tenant = await requireTenantById(req.tenantId!);
      const waId = sandboxWaId(req);

      // Garante o lead sandbox (marcado pra ficar fora de funil/métricas/scans).
      const lead = await upsertLead(tenant.id, waId, { nome: "🧪 Teste do painel" });
      await pool.query(`UPDATE leads SET is_sandbox = true WHERE id = $1 AND is_sandbox = false`, [lead.id]);

      // Histórico: grava a fala do testador (runTurn cuida do resto).
      const { logMessage } = await import("../core/db.js");
      await logMessage(lead.id, "in", "user", text).catch(() => undefined);

      const started = Date.now();
      const result = await runTurn(tenant, waId, text, "Sandbox", { sandbox: true });

      if (result.replyText) {
        await logMessage(lead.id, "out", "assistant", result.replyText).catch(() => undefined);
      }
      logger.info(
        { tenant: tenant.slug, waId, state: result.newState, ms: Date.now() - started },
        "sandbox: turno executado",
      );

      const fresh = await getLead(tenant.id, waId);
      return {
        reply: result.replyText,
        state: result.newState,
        slots: fresh?.slots ?? {},
        closed_reason: result.closedReason,
        handoff: !!result.closedByHandoff,
        retrying: !!result.retryAfterMs, // LLM instável: a resposta foi um "1 minuto"
      };
    });

    // Recomeça do zero: apaga lead, mensagens e memória Redis do sandbox.
    scope.post("/admin/tenants/:slug/sandbox/reset", async (req) => {
      const tenant = await requireTenantById(req.tenantId!);
      const waId = sandboxWaId(req);
      await clearSandboxRedis(tenant.slug, waId);
      await resetLead(tenant.id, waId);
      return { ok: true };
    });
  });
}
