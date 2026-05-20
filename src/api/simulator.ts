import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { appendBuffer } from "../workers/buffer.js";
import { inboundQueue, debounceJobId } from "../workers/queues.js";
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

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "..", "public");

export async function registerSimulatorRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    const file = path.join(publicDir, "simulator.html");
    const html = fs.readFileSync(file, "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/sim/leads", async () => {
    const leads = await listLeads(100);
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
    const q = req.query as { waId?: string; sinceId?: string };
    if (!q.waId) return reply.code(400).send({ error: "waId required" });
    const lead = await getLead(q.waId);
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
    const body = req.body as { waId?: string; text?: string; pushName?: string };
    if (!body?.waId || !body?.text) {
      return reply.code(400).send({ error: "waId and text required" });
    }
    const waId = body.waId.replace(/\D/g, "");
    const lead = await upsertLead(waId, { nome: body.pushName ?? null });

    // grava a mensagem no DB imediatamente (para a UI ver na hora)
    const { id: messageId, created_at } = await logMessage(lead.id, "in", "user", body.text);
    await markLastActivity(waId, "user");

    await appendBuffer(waId, {
      ts: Date.now(),
      text: body.text,
      messageId: `sim-${messageId}`,
    });

    await inboundQueue
      .add(
        "process",
        { waId, pushName: body.pushName },
        {
          jobId: debounceJobId(waId),
          delay: config.DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
      .catch(async (err) => {
        if (String(err?.message ?? "").includes("already exists")) {
          logger.debug({ waId }, "simulator: debounce already pending, buffer extended");
          return;
        }
        throw err;
      });

    return { ok: true, messageId, created_at };
  });

  app.post("/sim/reset", async (req, reply) => {
    const body = req.body as { waId?: string };
    if (!body?.waId) return reply.code(400).send({ error: "waId required" });
    await resetLead(body.waId);
    return { ok: true };
  });

  app.post("/sim/reopen", async (req, reply) => {
    const body = req.body as { waId?: string };
    if (!body?.waId) return reply.code(400).send({ error: "waId required" });
    await reopenConversation(body.waId);
    return { ok: true };
  });

  app.post("/sim/trigger-followup", async (req, reply) => {
    const body = req.body as { waId?: string; stage?: 1 | 2 | 3 };
    if (!body?.waId || !body?.stage) {
      return reply.code(400).send({ error: "waId and stage required" });
    }
    const { scheduleFollowup } = await import("../workers/queues.js");
    await scheduleFollowup(body.waId, body.stage, 500);
    return { ok: true };
  });
}
