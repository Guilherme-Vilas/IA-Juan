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
import { getTenantBySlug, listTenants } from "../core/tenants.js";

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

  // ===== Tenants =====
  app.get("/admin/tenants", async () => {
    const tenants = await listTenants();
    return {
      tenants: tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        evolution_instance: t.evolution_instance,
        owner_name: t.owner_name,
        playbook_slug: t.playbook_slug,
        active: t.active,
      })),
    };
  });

  // ===== Lead actions per tenant =====
  app.post("/admin/tenants/:slug/leads/:waId/pause", async (req, reply) => {
    const { slug, waId } = req.params as { slug: string; waId: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    await updateLead(tenant.id, waId, { paused: true });
    logger.info({ tenant: slug, waId }, "admin: paused");
    return reply.send({ ok: true });
  });

  app.post("/admin/tenants/:slug/leads/:waId/reopen", async (req, reply) => {
    const { slug, waId } = req.params as { slug: string; waId: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    await reopenConversation(tenant.id, waId);
    await updateLead(tenant.id, waId, { paused: false });
    logger.info({ tenant: slug, waId }, "admin: reopened");
    return reply.send({ ok: true });
  });

  app.post("/admin/tenants/:slug/leads/:waId/close", async (req, reply) => {
    const { slug, waId } = req.params as { slug: string; waId: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const body = req.body as { reason?: string };
    const reason = (body?.reason ?? "") as ClosedReason;
    if (!ADMIN_REASONS.has(reason)) {
      return reply.code(400).send({ error: "invalid reason" });
    }
    await closeConversation(tenant.id, waId, reason);
    logger.info({ tenant: slug, waId, reason }, "admin: closed");
    return reply.send({ ok: true });
  });

  app.post("/admin/tenants/:slug/leads/:waId/state", async (req, reply) => {
    const { slug, waId } = req.params as { slug: string; waId: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const body = req.body as { state?: string };
    const state = body?.state as LeadState | undefined;
    if (!state || !ADMIN_STATES.has(state)) {
      return reply.code(400).send({ error: "invalid state" });
    }
    await updateLead(tenant.id, waId, { state });
    logger.info({ tenant: slug, waId, state }, "admin: state moved");
    return reply.send({ ok: true });
  });

  app.post("/admin/tenants/:slug/leads/:waId/send", async (req, reply) => {
    const { slug, waId } = req.params as { slug: string; waId: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });

    const body = req.body as { text?: string };
    const text = (body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "empty text" });

    const lead = await getLead(tenant.id, waId);
    if (!lead) return reply.code(404).send({ error: "lead not found" });

    // takeover: pausa a IA antes de mandar
    await updateLead(tenant.id, waId, { paused: true });

    await logMessage(lead.id, "out", "assistant", `[${tenant.owner_name}] ${text}`);
    await markLastActivity(tenant.id, waId, "assistant");

    try {
      const k = keys.leadHistory(tenant.slug, waId);
      await redis.rpush(k, JSON.stringify({ role: "assistant", content: text }));
      await redis.ltrim(k, -16, -1);
      await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err }, "admin.send: history push failed");
    }

    try {
      await sendText(tenant, waId, text);
      logger.info({ tenant: slug, waId }, "admin: takeover sent");
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err, tenant: slug, waId }, "admin: takeover failed");
      return reply.code(500).send({ error: String(err) });
    }
  });
}
