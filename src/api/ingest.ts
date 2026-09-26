import type { FastifyInstance } from "fastify";
import { ingestLead, type IngestPayload } from "../core/ingest.js";
import { rateLimit } from "../core/rate-limit.js";

// Endpoint PUBLICO de captura de leads (sem auth de usuario; protegido por token).
// Conecte aqui: formularios do site, widget, Meta Lead Ads via Zapier/Make, etc.
export async function registerIngestRoutes(app: FastifyInstance) {
  app.post("/ingest/lead", async (req, reply) => {
    const q = req.query as { token?: string };
    const headerToken = req.headers["x-ingest-token"] as string | undefined;
    const body = (req.body ?? {}) as IngestPayload & { token?: string };
    const token = q.token || headerToken || body.token;
    if (!token) return reply.code(401).send({ error: "token obrigatório" });

    // Token vazado não pode virar inundação de leads + saudações no WhatsApp.
    const fwd = req.headers["x-forwarded-for"];
    const ip = typeof fwd === "string" && fwd ? fwd.split(",")[0]!.trim() : req.ip;
    const [byToken, byIp] = await Promise.all([
      rateLimit(`ingest:token:${token}`, 60, 60),
      rateLimit(`ingest:ip:${ip}`, 120, 60),
    ]);
    if (!byToken.allowed || !byIp.allowed) {
      return reply.code(429).send({ error: "rate limit — tente novamente em instantes" });
    }

    const res = await ingestLead(token, {
      phone: body.phone,
      wa_id: body.wa_id,
      name: body.name,
      source: body.source,
      utm: body.utm,
      custom: body.custom,
    });
    if (!res.ok) {
      const code = res.error === "token inválido" ? 401 : 400;
      return reply.code(code).send({ error: res.error });
    }
    return reply.code(201).send({ ok: true, wa_id: res.wa_id, created: res.created });
  });
}
