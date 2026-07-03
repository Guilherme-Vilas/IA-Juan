import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { parseWebhook, downloadMedia } from "../core/evolution.js";
import { transcribeAudio } from "../core/transcribe.js";
import { appendBuffer } from "../workers/buffer.js";
import { inboundQueue, debounceJobId } from "../workers/queues.js";
import { logMessage, markLastActivity, upsertLead } from "../core/db.js";
import { handleProspectReply } from "../prospect/handoff.js";
import { getTenantByInstance } from "../core/tenants.js";

export async function registerRoutes(app: FastifyInstance) {
  // /health deep check vive no index.ts (testa Postgres + Redis).

  app.post("/webhook/evolution", async (req, reply) => {
    const token =
      (req.headers["x-webhook-token"] as string | undefined) ??
      (req.query as { token?: string } | undefined)?.token;
    if (token !== config.EVOLUTION_WEBHOOK_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = parseWebhook(req.body);
    if (!parsed) return reply.send({ ignored: "unparseable" });
    if (parsed.fromMe) return reply.send({ ignored: "fromMe" });

    const tenant = await getTenantByInstance(parsed.instance);
    if (!tenant) {
      logger.warn({ instance: parsed.instance, waId: parsed.waId }, "webhook: unknown instance");
      return reply.send({ ignored: "unknown_instance" });
    }
    if (!tenant.active) {
      logger.debug({ tenant: tenant.slug, waId: parsed.waId }, "webhook: tenant inactive — ignoring");
      return reply.send({ ignored: "tenant_inactive" });
    }

    let text = parsed.text ?? "";

    if (parsed.type === "audio" && parsed.audioMessageId) {
      try {
        const buf = await downloadMedia(tenant, parsed.audioMessageId);
        text = await transcribeAudio(buf, `${parsed.audioMessageId}.ogg`);
        logger.info({ tenant: tenant.slug, waId: parsed.waId, chars: text.length }, "audio transcribed");
      } catch (err) {
        logger.error({ err, tenant: tenant.slug, waId: parsed.waId }, "audio download/transcribe failed");
        text = "[lead enviou um áudio que não consegui ouvir]";
      }
    }

    if (parsed.type === "other") {
      logger.info({ tenant: tenant.slug, waId: parsed.waId }, "unsupported message type");
      return reply.send({ ignored: "unsupported" });
    }

    if (!text.trim()) return reply.send({ ignored: "empty" });

    // Se essa primeira resposta vem de um prospect (cold outreach), faz o handoff:
    // vincula o prospect a um lead, copia nome/empresa, marca source='campaign:N'.
    // Opt-out ("pare", "não me mande mais"): blacklista, confirma e NÃO aciona a IA.
    const handoff = await handleProspectReply(tenant, parsed.waId, parsed.pushName ?? null, text).catch((err) => {
      logger.warn({ err, tenant: tenant.slug, waId: parsed.waId }, "prospect handoff failed (continuing as normal lead)");
      return { matched: false as const };
    });
    if (handoff.matched && "optedOut" in handoff && handoff.optedOut) {
      return reply.send({ ok: true, optedOut: true });
    }

    const lead = await upsertLead(tenant.id, parsed.waId, { nome: parsed.pushName ?? null });
    await logMessage(lead.id, "in", "user", text);
    await markLastActivity(tenant.id, parsed.waId, "user");

    await appendBuffer(tenant.slug, parsed.waId, {
      ts: parsed.timestamp,
      text,
      messageId: parsed.messageId,
    });

    await inboundQueue
      .add(
        "process",
        { tenantId: tenant.id, waId: parsed.waId, pushName: parsed.pushName },
        {
          jobId: debounceJobId(tenant.id, parsed.waId),
          delay: config.DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
      .catch(async (err) => {
        if (String(err?.message ?? "").includes("already exists")) {
          logger.debug({ tenant: tenant.slug, waId: parsed.waId }, "debounce: job already pending, buffer extended");
          return;
        }
        throw err;
      });

    return reply.send({ ok: true });
  });

}
