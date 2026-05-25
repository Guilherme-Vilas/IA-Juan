import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { parseWebhook, downloadMedia } from "../core/evolution.js";
import { transcribeAudio } from "../core/transcribe.js";
import { appendBuffer } from "../workers/buffer.js";
import { inboundQueue, debounceJobId } from "../workers/queues.js";
import { logMessage, markLastActivity, upsertLead } from "../core/db.js";
import { authUrl, saveTokensFromCode } from "../core/calendar.js";
import { handleProspectReply } from "../prospect/handoff.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.post("/webhook/evolution", async (req, reply) => {
    const token = (req.headers["x-webhook-token"] as string | undefined) ?? req.query?.["token"];
    if (token !== config.EVOLUTION_WEBHOOK_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = parseWebhook(req.body);
    if (!parsed) return reply.send({ ignored: "unparseable" });
    if (parsed.fromMe) return reply.send({ ignored: "fromMe" });

    let text = parsed.text ?? "";

    if (parsed.type === "audio" && parsed.audioMessageId) {
      try {
        const buf = await downloadMedia(parsed.audioMessageId);
        text = await transcribeAudio(buf, `${parsed.audioMessageId}.ogg`);
        logger.info({ waId: parsed.waId, chars: text.length }, "audio transcribed");
      } catch (err) {
        logger.error({ err, waId: parsed.waId }, "audio download/transcribe failed");
        text = "[lead enviou um áudio que não consegui ouvir]";
      }
    }

    if (parsed.type === "other") {
      logger.info({ waId: parsed.waId }, "unsupported message type");
      return reply.send({ ignored: "unsupported" });
    }

    if (!text.trim()) return reply.send({ ignored: "empty" });

    // Se essa primeira resposta vem de um prospect (cold outreach), faz o handoff:
    // vincula o prospect a um lead, copia nome/empresa, marca source='campaign:N'.
    // Operação é idempotente (não duplica se já handed-off).
    await handleProspectReply(parsed.waId, parsed.pushName ?? null).catch((err) =>
      logger.warn({ err, waId: parsed.waId }, "prospect handoff failed (continuing as normal lead)"),
    );

    const lead = await upsertLead(parsed.waId, { nome: parsed.pushName ?? null });
    await logMessage(lead.id, "in", "user", text);
    await markLastActivity(parsed.waId, "user");

    await appendBuffer(parsed.waId, {
      ts: parsed.timestamp,
      text,
      messageId: parsed.messageId,
    });

    await inboundQueue.add(
      "process",
      { waId: parsed.waId, pushName: parsed.pushName },
      {
        jobId: debounceJobId(parsed.waId),
        delay: config.DEBOUNCE_MS,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    ).catch(async (err) => {
      if (String(err?.message ?? "").includes("already exists")) {
        logger.debug({ waId: parsed.waId }, "debounce: job already pending, buffer extended");
        return;
      }
      throw err;
    });

    return reply.send({ ok: true });
  });

  app.get("/oauth/google/start", async (_req, reply) => {
    try {
      return reply.redirect(authUrl());
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.get("/oauth/google/callback", async (req, reply) => {
    const code = (req.query as { code?: string })?.code;
    if (!code) return reply.code(400).send({ error: "missing code" });
    try {
      await saveTokensFromCode(code);
      return reply.send({ ok: true, msg: "Google Calendar autorizado. Pode fechar esta aba." });
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });
}
