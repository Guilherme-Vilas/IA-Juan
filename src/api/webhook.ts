import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { parseWebhook, parseConnectionUpdate, downloadMedia } from "../core/evolution.js";
import { handleConnectionUpdate } from "../core/connection-monitor.js";
import { consumeEcho } from "../core/echo.js";
import { redis, keys } from "../core/redis.js";
import { pauseAi } from "../sdr/handoff.js";
import { transcribeAudio } from "../core/transcribe.js";
import { appendBuffer } from "../workers/buffer.js";
import { inboundQueue, debounceJobId } from "../workers/queues.js";
import { getLead, logMessage, markLastActivity, upsertLead } from "../core/db.js";
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

    // CONNECTION_UPDATE: estado do chip. Alimenta o monitor (alerta por e-mail
    // na queda + pausa de campanhas/follow-ups enquanto estiver caído).
    const conn = parseConnectionUpdate(req.body);
    if (conn) {
      const t = await getTenantByInstance(conn.instance);
      if (t) await handleConnectionUpdate(t, conn.state).catch((err) =>
        logger.warn({ err, instance: conn.instance }, "webhook: connection update falhou"),
      );
      return reply.send({ ok: true, connection: conn.state });
    }

    const parsed = parseWebhook(req.body);
    if (!parsed) return reply.send({ ignored: "unparseable" });

    const tenant = await getTenantByInstance(parsed.instance);
    if (!tenant) {
      logger.warn({ instance: parsed.instance, waId: parsed.waId }, "webhook: unknown instance");
      return reply.send({ ignored: "unknown_instance" });
    }
    if (!tenant.active) {
      logger.debug({ tenant: tenant.slug, waId: parsed.waId }, "webhook: tenant inactive — ignoring");
      return reply.send({ ignored: "tenant_inactive" });
    }

    // Idempotência: a Evolution re-entrega em timeout/retry. Cada messageId
    // processa UMA vez (janela de 6h).
    const dedupeOk = await redis
      .set(`dedupe:msg:${tenant.id}:${parsed.messageId}`, "1", "EX", 6 * 3600, "NX")
      .catch(() => "OK" as const); // Redis fora: fail-open (melhor duplicar que perder)
    if (dedupeOk !== "OK") {
      return reply.send({ ignored: "duplicate" });
    }

    // fromMe: ou é ECO de algo que o sistema enviou (ignora), ou é o DONO
    // digitando no celular → takeover: pausa a IA e registra a fala dele, pra
    // ela não responder por cima e ter o contexto quando for retomada.
    if (parsed.fromMe) {
      if (parsed.type !== "text" || !parsed.text?.trim()) return reply.send({ ignored: "fromMe" });
      const isEcho = await consumeEcho(tenant.slug, parsed.waId, parsed.text);
      if (isEcho) return reply.send({ ignored: "fromMe_echo" });

      const existing = await getLead(tenant.id, parsed.waId);
      if (!existing) return reply.send({ ignored: "fromMe_not_a_lead" });

      await logMessage(existing.id, "out", "assistant", parsed.text).catch(() => undefined);
      await markLastActivity(tenant.id, parsed.waId, "assistant").catch(() => undefined);
      try {
        const k = keys.leadHistory(tenant.slug, parsed.waId);
        await redis.rpush(k, JSON.stringify({ role: "assistant", content: parsed.text }));
        await redis.ltrim(k, -16, -1);
        await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
      } catch {
        /* memória é best-effort */
      }
      if (!existing.paused) {
        await pauseAi(tenant, parsed.waId).catch(() => undefined);
        logger.info({ tenant: tenant.slug, waId: parsed.waId }, "takeover: dono respondeu pelo celular → IA pausada");
      }
      return reply.send({ ok: true, takeover: true });
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
        if (!String(err?.message ?? "").includes("already exists")) throw err;
        // Job com esse id já existe. Se ainda está NA ESPERA (delayed/waiting),
        // ótimo: o buffer foi estendido e ele vai drenar tudo. Mas se já está
        // RODANDO (ou terminou), esta mensagem ficaria órfã no buffer até o lead
        // falar de novo — então agenda um job novo com id único.
        const existing = await inboundQueue.getJob(debounceJobId(tenant.id, parsed.waId)).catch(() => null);
        const state = existing ? await existing.getState().catch(() => "unknown") : "unknown";
        if (state === "delayed" || state === "waiting" || state === "waiting-children") {
          logger.debug({ tenant: tenant.slug, waId: parsed.waId }, "debounce: job pendente, buffer estendido");
          return;
        }
        await inboundQueue.add(
          "process",
          { tenantId: tenant.id, waId: parsed.waId, pushName: parsed.pushName },
          {
            jobId: `${debounceJobId(tenant.id, parsed.waId)}:${Date.now()}`,
            delay: config.DEBOUNCE_MS,
            removeOnComplete: true,
            removeOnFail: 50,
          },
        );
        logger.debug({ tenant: tenant.slug, waId: parsed.waId, prevState: state }, "debounce: job ativo — reagendado com id único");
      });

    return reply.send({ ok: true });
  });

}
