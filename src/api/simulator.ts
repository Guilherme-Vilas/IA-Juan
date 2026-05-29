import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { appendBuffer } from "../workers/buffer.js";
import { inboundQueue, debounceJobId, scheduleFollowup } from "../workers/queues.js";
import {
  getLead,
  listLeads,
  listMessages,
  logMessage,
  markLastActivity,
  resetLead,
  reopenConversation,
  upsertLead,
} from "../core/db.js";
import { getTenantBySlug, defaultTenant } from "../core/tenants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "..", "public");

// Helper: resolve tenant via query ?tenant=<slug>, fallback pra default (Juan).
// Mantém compat com cliente atual que ainda não passa tenant.
async function resolveTenant(slug?: string) {
  if (slug) {
    const t = await getTenantBySlug(slug);
    if (t) return t;
  }
  return await defaultTenant();
}

export async function registerSimulatorRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    const file = path.join(publicDir, "simulator.html");
    const html = fs.readFileSync(file, "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/sim/leads", async (req) => {
    const q = req.query as { tenant?: string };
    const tenant = await resolveTenant(q.tenant);
    const leads = await listLeads(tenant.id, 100);
    return leads.map((l) => ({
      wa_id: l.wa_id,
      nome: l.nome,
      state: l.state,
      status: l.status,
      closed_reason: l.closed_reason,
      last_user_at: l.last_user_at,
      last_assistant_at: l.last_assistant_at,
      updated_at: l.updated_at,
      slots: l.slots,
    }));
  });

  app.get("/sim/messages", async (req, reply) => {
    const q = req.query as { waId?: string; sinceId?: string; tenant?: string };
    if (!q.waId) return reply.code(400).send({ error: "waId required" });
    const tenant = await resolveTenant(q.tenant);
    const lead = await getLead(tenant.id, q.waId);
    if (!lead) return { lead: null, messages: [] };
    const msgs = await listMessages(lead.id, Number(q.sinceId ?? 0), 500);
    return {
      lead: {
        wa_id: lead.wa_id,
        nome: lead.nome,
        state: lead.state,
        status: lead.status,
        closed_reason: lead.closed_reason,
        slots: lead.slots,
      },
      messages: msgs.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        created_at: m.created_at,
      })),
    };
  });

  app.post("/sim/inbound", async (req, reply) => {
    const body = req.body as { waId?: string; text?: string; pushName?: string; tenant?: string };
    if (!body?.waId || !body?.text) {
      return reply.code(400).send({ error: "waId and text required" });
    }
    const tenant = await resolveTenant(body.tenant);
    const waId = body.waId.replace(/\D/g, "");
    const lead = await upsertLead(tenant.id, waId, { nome: body.pushName ?? null });

    const { id: messageId, created_at } = await logMessage(lead.id, "in", "user", body.text);
    await markLastActivity(tenant.id, waId, "user");

    await appendBuffer(tenant.slug, waId, {
      ts: Date.now(),
      text: body.text,
      messageId: `sim-${messageId}`,
    });

    await inboundQueue
      .add(
        "process",
        { tenantId: tenant.id, waId, pushName: body.pushName },
        {
          jobId: debounceJobId(tenant.id, waId),
          delay: config.DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
      .catch(async (err) => {
        if (String(err?.message ?? "").includes("already exists")) {
          logger.debug({ tenant: tenant.slug, waId }, "simulator: debounce already pending, buffer extended");
          return;
        }
        throw err;
      });

    return { ok: true, messageId, created_at };
  });

  app.post("/sim/reset", async (req, reply) => {
    const body = req.body as { waId?: string; tenant?: string };
    if (!body?.waId) return reply.code(400).send({ error: "waId required" });
    const tenant = await resolveTenant(body.tenant);
    await resetLead(tenant.id, body.waId);
    return { ok: true };
  });

  app.post("/sim/reopen", async (req, reply) => {
    const body = req.body as { waId?: string; tenant?: string };
    if (!body?.waId) return reply.code(400).send({ error: "waId required" });
    const tenant = await resolveTenant(body.tenant);
    await reopenConversation(tenant.id, body.waId);
    return { ok: true };
  });

  app.post("/sim/trigger-followup", async (req, reply) => {
    const body = req.body as { waId?: string; stage?: 1 | 2 | 3; tenant?: string };
    if (!body?.waId || !body?.stage) {
      return reply.code(400).send({ error: "waId and stage required" });
    }
    const tenant = await resolveTenant(body.tenant);
    await scheduleFollowup(tenant.id, body.waId, body.stage, 500);
    return { ok: true };
  });
}
