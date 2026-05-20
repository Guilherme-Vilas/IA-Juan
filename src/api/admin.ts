import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { sendText } from "../core/evolution.js";
import {
  closeConversation,
  getLead,
  logMessage,
  markLastActivity,
  reopenConversation,
  updateLead,
  type ClosedReason,
  type LeadState,
} from "../core/db.js";
import { redis, keys } from "../core/redis.js";

function requireAdmin(token: string | undefined): boolean {
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  return !!expected && token === expected;
}

const ADMIN_STATES = new Set<LeadState>([
  "S0_ABERTURA",
  "S1_DESCOBERTA",
  "S2_QUALIFICACAO",
  "S3_EDUCACAO",
  "S4_AGENDAMENTO",
  "S5_CONFIRMADO",
  "HANDOFF",
]);

const ADMIN_REASONS = new Set<ClosedReason>([
  "scheduled",
  "not_interested",
  "postponed",
  "handoff",
  "no_response",
]);

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin")) return;
    const token = (req.headers["x-admin-token"] as string | undefined) ?? "";
    if (!requireAdmin(token)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.post("/admin/leads/:waId/pause", async (req, reply) => {
    const { waId } = req.params as { waId: string };
    await updateLead(waId, { paused: true });
    logger.info({ waId }, "admin: paused");
    return reply.send({ ok: true });
  });

  app.post("/admin/leads/:waId/reopen", async (req, reply) => {
    const { waId } = req.params as { waId: string };
    await reopenConversation(waId);
    await updateLead(waId, { paused: false });
    // limpa histórico Redis pra recomeçar contexto limpo? não — preserva
    logger.info({ waId }, "admin: reopened");
    return reply.send({ ok: true });
  });

  app.post("/admin/leads/:waId/close", async (req, reply) => {
    const { waId } = req.params as { waId: string };
    const body = req.body as { reason?: string };
    const reason = (body?.reason ?? "") as ClosedReason;
    if (!ADMIN_REASONS.has(reason)) {
      return reply.code(400).send({ error: "invalid reason" });
    }
    await closeConversation(waId, reason);
    logger.info({ waId, reason }, "admin: closed");
    return reply.send({ ok: true });
  });

  app.post("/admin/leads/:waId/state", async (req, reply) => {
    const { waId } = req.params as { waId: string };
    const body = req.body as { state?: string };
    const state = body?.state as LeadState | undefined;
    if (!state || !ADMIN_STATES.has(state)) {
      return reply.code(400).send({ error: "invalid state" });
    }
    await updateLead(waId, { state });
    logger.info({ waId, state }, "admin: state moved");
    return reply.send({ ok: true });
  });

  app.post("/admin/leads/:waId/send", async (req, reply) => {
    const { waId } = req.params as { waId: string };
    const body = req.body as { text?: string };
    const text = (body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "empty text" });

    const lead = await getLead(waId);
    if (!lead) return reply.code(404).send({ error: "lead not found" });

    // takeover: pausa a IA antes de mandar
    await updateLead(waId, { paused: true });

    // grava como assistant (manual) — assim aparece no DB/UI como uma mensagem nossa
    await logMessage(lead.id, "out", "assistant", `[Juan] ${text}`);
    await markLastActivity(waId, "assistant");

    // também guarda no histórico Redis pra IA ver caso reative
    try {
      const k = keys.leadHistory(waId);
      await redis.rpush(k, JSON.stringify({ role: "assistant", content: text }));
      await redis.ltrim(k, -16, -1);
      await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err }, "admin.send: history push failed");
    }

    try {
      await sendText(waId, text);
      logger.info({ waId }, "admin: takeover sent");
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err, waId }, "admin: takeover failed");
      return reply.code(500).send({ error: String(err) });
    }
  });
}
