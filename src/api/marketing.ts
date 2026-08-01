import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { pool } from "../core/db.js";
import { redis } from "../core/redis.js";
import { requireSuperadmin } from "../auth/plugin.js";
import {
  emailEnabled,
  renderEmail,
  sendEmail,
  sendDiagnosticoConfirmEmail,
  sendSubscribeConfirmEmail,
} from "../core/email.js";
import { marketingQueue, marketingJobId } from "../workers/queues.js";

// ============================================================================
// E-mail marketing INTERNO (superadmin) — nutrir interessados na Vita OS.
// Base de contatos própria + campanhas com o template da marca + descadastro
// de 1 clique (LGPD/entregabilidade). O envio roda em fila, com ritmo.
// ============================================================================

export type ContactRow = {
  id: number;
  email: string;
  name: string | null;
  source: string | null;
  subscribed: boolean;
  unsubscribe_token: string;
  created_at: Date;
};

export type MktCampaignRow = {
  id: number;
  subject: string;
  title: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  status: "draft" | "sending" | "done" | "failed";
  total: number;
  sent: number;
  failed: number;
  created_at: Date;
  sent_at: Date | null;
};

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Corpo em texto → parágrafos HTML (linha em branco separa).
export function bodyTextToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function unsubscribeUrl(token: string): string {
  return `${config.PUBLIC_BASE_URL}/mkt/unsubscribe/${token}`;
}

// E-mail de campanha = template da marca + rodapé de descadastro obrigatório.
export function renderCampaignEmail(c: Pick<MktCampaignRow, "title" | "body_text" | "cta_label" | "cta_url">, unsubToken: string): string {
  const unsub = unsubscribeUrl(unsubToken);
  const base = renderEmail({
    title: c.title,
    bodyHtml: bodyTextToHtml(c.body_text),
    cta: c.cta_label && c.cta_url ? { label: c.cta_label, url: c.cta_url } : undefined,
    footerNote: "Vita OS · systemvita.com.br",
  });
  // injeta o link de descadastro no rodapé (antes do </body>)
  const unsubHtml = `<div style="text-align:center;padding:8px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#52525B">
    Não quer mais receber? <a href="${unsub}" style="color:#71717A">Descadastre-se aqui</a>.
  </div>`;
  return base.replace("</body>", `${unsubHtml}</body>`);
}

// Inscrição na base (landing, demo, futuras fontes). Quem se inscreve de novo
// após descadastro é RE-inscrito — é consentimento explícito e renovado.
export async function subscribeContact(
  email: string,
  name: string | null,
  source: string,
): Promise<{ status: "added" | "resubscribed" | "invalid"; token: string | null }> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean) || clean.length > 200) return { status: "invalid", token: null };
  const { rows } = await pool.query<{ inserted: boolean; unsubscribe_token: string }>(
    `INSERT INTO marketing_contacts (email, name, source, unsubscribe_token)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (lower(email)) DO UPDATE
       SET subscribed = true,
           unsubscribed_at = NULL,
           name = COALESCE(marketing_contacts.name, EXCLUDED.name)
     RETURNING (xmax = 0) AS inserted, unsubscribe_token`,
    [clean, name?.trim()?.slice(0, 120) || null, source, crypto.randomBytes(18).toString("base64url")],
  );
  const r = rows[0];
  if (!r) return { status: "invalid", token: null };
  return { status: r.inserted ? "added" : "resubscribed", token: r.unsubscribe_token };
}

function publicIp(req: FastifyRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip;
}

export async function registerMarketingRoutes(app: FastifyInstance) {
  // ===== Inscrição pública (captura da landing) =====
  app.post("/mkt/subscribe", async (req, reply) => {
    const body = req.body as { email?: string; name?: string; source?: string; website?: string };
    // honeypot: bot que preenche o campo invisível é ignorado em silêncio
    if (body?.website) return reply.send({ ok: true });

    const ip = publicIp(req);
    const hits = await redis.incr(`mkt:sub:${ip}`);
    await redis.expire(`mkt:sub:${ip}`, 86_400);
    if (hits > 15) return reply.code(429).send({ error: "muitas tentativas — tente amanhã" });

    const result = await subscribeContact(
      body?.email ?? "",
      body?.name ?? null,
      (body?.source ?? "landing").slice(0, 40),
    );
    if (result.status === "invalid") return reply.code(400).send({ error: "informe um e-mail válido" });

    // Confirmação de inscrição (best-effort) — com descadastro de 1 clique.
    if (result.token) {
      sendSubscribeConfirmEmail((body!.email as string).trim(), unsubscribeUrl(result.token)).catch((err) =>
        logger.warn({ err }, "mkt: confirmação de inscrição falhou"),
      );
    }
    logger.info({ result: result.status, source: body?.source }, "mkt: inscrição pela landing");
    return reply.send({ ok: true });
  });

  // ===== Diagnóstico comercial gratuito (lead magnet da landing) =====
  app.post("/mkt/diagnostico", async (req, reply) => {
    const b = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      sector?: string;
      company_size?: string;
      leads_per_month?: string;
      response_time?: string;
      main_challenge?: string;
      website?: string; // honeypot
    };
    if (b?.website) return reply.send({ ok: true });

    const ip = publicIp(req);
    const hits = await redis.incr(`mkt:diag:${ip}`);
    await redis.expire(`mkt:diag:${ip}`, 86_400);
    if (hits > 5) return reply.code(429).send({ error: "muitas tentativas — tente amanhã" });

    const name = (b?.name ?? "").trim().slice(0, 120);
    const email = (b?.email ?? "").trim();
    const phone = (b?.phone ?? "").replace(/\D/g, "");
    if (!name || !isValidEmail(email)) {
      return reply.code(400).send({ error: "nome e e-mail válidos são obrigatórios" });
    }
    const answers = {
      setor: (b?.sector ?? "").slice(0, 60),
      tamanho_empresa: (b?.company_size ?? "").slice(0, 40),
      leads_por_mes: (b?.leads_per_month ?? "").slice(0, 40),
      tempo_resposta: (b?.response_time ?? "").slice(0, 60),
      maior_gargalo: (b?.main_challenge ?? "").slice(0, 300),
    };

    // 1. entra na base de nutrição
    const sub = await subscribeContact(email, name, "diagnostico");

    // 2. vira lead no pipeline comercial (quando o token de ingestão existe)
    if (phone.length >= 10 && config.DEMO_CAPTURE_INGEST_TOKEN) {
      const { ingestLead } = await import("../core/ingest.js");
      await ingestLead(config.DEMO_CAPTURE_INGEST_TOKEN, {
        phone,
        name,
        source: "diagnostico",
        utm: { origem: "diagnostico-landing", ...answers },
      }).catch((err) => logger.warn({ err }, "diagnostico: ingest falhou"));
    }

    // 3. notifica a equipe com as respostas completas
    sendEmail({
      to: "contato@systemvita.com.br",
      subject: `🔍 Novo diagnóstico: ${name}${answers.setor ? ` (${answers.setor})` : ""}`,
      html: renderEmail({
        title: "Novo pedido de diagnóstico comercial",
        bodyHtml: [
          `<strong style="color:#E6E6E6">Nome:</strong> ${name}`,
          `<strong style="color:#E6E6E6">E-mail:</strong> ${email}`,
          phone ? `<strong style="color:#E6E6E6">WhatsApp:</strong> ${phone}` : null,
          `<strong style="color:#E6E6E6">Setor:</strong> ${answers.setor || "—"}`,
          `<strong style="color:#E6E6E6">Tamanho:</strong> ${answers.tamanho_empresa || "—"}`,
          `<strong style="color:#E6E6E6">Leads/mês:</strong> ${answers.leads_por_mes || "—"}`,
          `<strong style="color:#E6E6E6">Tempo de resposta hoje:</strong> ${answers.tempo_resposta || "—"}`,
          `<strong style="color:#E6E6E6">Maior gargalo:</strong> ${answers.maior_gargalo || "—"}`,
        ]
          .filter(Boolean)
          .join("<br>"),
      }),
    }).catch((err) => logger.warn({ err }, "diagnostico: notificação da equipe falhou"));

    // 4. confirma pro interessado
    sendDiagnosticoConfirmEmail(email, name).catch((err) =>
      logger.warn({ err }, "diagnostico: confirmação falhou"),
    );

    logger.info({ name, setor: answers.setor, sub: sub.status }, "diagnostico: recebido");
    return reply.send({ ok: true });
  });

  // ===== Descadastro público de 1 clique =====
  app.get("/mkt/unsubscribe/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const { rowCount } = await pool.query(
      `UPDATE marketing_contacts SET subscribed = false, unsubscribed_at = now()
        WHERE unsubscribe_token = $1 AND subscribed = true`,
      [token],
    );
    if (rowCount) logger.info({ token: token.slice(0, 6) }, "mkt: descadastro");
    return reply.type("text/html").send(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Vita OS</title></head>
       <body style="margin:0;background:#0A0A0C;color:#E6E6E6;font-family:Georgia,serif;display:grid;place-items:center;height:100vh;text-align:center">
       <div><div style="font-size:40px;color:#C9A876">✓</div>
       <h1 style="font-weight:normal;font-size:22px">Pronto — você não receberá mais e-mails nossos.</h1>
       <p style="color:#71717A;font-family:Arial;font-size:13px">Mudou de ideia? É só falar com a gente.</p></div></body></html>`,
    );
  });

  // ===== Área do superadmin =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);

    // --- Contatos ---
    scope.get("/admin/marketing/contacts", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const { rows } = await pool.query<ContactRow>(
        `SELECT * FROM marketing_contacts ORDER BY created_at DESC LIMIT 1000`,
      );
      const subscribed = rows.filter((r) => r.subscribed).length;
      return { contacts: rows, subscribed, total: rows.length };
    });

    // Adiciona um ou vários (cole e-mails separados por vírgula/linha; aceita "Nome <email>").
    scope.post("/admin/marketing/contacts", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const body = req.body as { raw?: string; source?: string };
      const raw = (body?.raw ?? "").trim();
      if (!raw) return reply.code(400).send({ error: "cole pelo menos um e-mail" });

      let added = 0;
      let duplicates = 0;
      let invalid = 0;
      const entries = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      for (const entry of entries.slice(0, 2000)) {
        const m = entry.match(/^(.*?)[<\s]*([^\s<>,;]+@[^\s<>,;]+)>?$/);
        const email = (m?.[2] ?? entry).toLowerCase().trim();
        const name = m?.[1]?.replace(/["<>]/g, "").trim() || null;
        if (!isValidEmail(email)) {
          invalid++;
          continue;
        }
        const res = await pool.query(
          `INSERT INTO marketing_contacts (email, name, source, unsubscribe_token)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (lower(email)) DO NOTHING`,
          [email, name, body?.source ?? "manual", crypto.randomBytes(18).toString("base64url")],
        );
        if (res.rowCount && res.rowCount > 0) added++;
        else duplicates++;
      }
      logger.info({ added, duplicates, invalid }, "mkt: contatos importados");
      return reply.send({ added, duplicates, invalid });
    });

    scope.delete("/admin/marketing/contacts/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const id = Number((req.params as { id: string }).id);
      await pool.query(`DELETE FROM marketing_contacts WHERE id = $1`, [id]);
      return reply.send({ ok: true });
    });

    // --- Campanhas ---
    scope.get("/admin/marketing/campaigns", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const { rows } = await pool.query<MktCampaignRow>(
        `SELECT * FROM marketing_campaigns ORDER BY created_at DESC LIMIT 100`,
      );
      return { campaigns: rows };
    });

    scope.post("/admin/marketing/campaigns", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const b = req.body as Partial<MktCampaignRow>;
      if (!b?.subject?.trim() || !b?.title?.trim() || !b?.body_text?.trim()) {
        return reply.code(400).send({ error: "subject, title e body_text são obrigatórios" });
      }
      const { rows } = await pool.query<MktCampaignRow>(
        `INSERT INTO marketing_campaigns (subject, title, body_text, cta_label, cta_url)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [b.subject.trim(), b.title.trim(), b.body_text, b.cta_label?.trim() || null, b.cta_url?.trim() || null],
      );
      return reply.send({ campaign: rows[0] });
    });

    scope.patch("/admin/marketing/campaigns/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const id = Number((req.params as { id: string }).id);
      const b = req.body as Partial<MktCampaignRow>;
      const { rows } = await pool.query<MktCampaignRow>(
        `UPDATE marketing_campaigns
            SET subject = COALESCE($1, subject), title = COALESCE($2, title),
                body_text = COALESCE($3, body_text), cta_label = $4, cta_url = $5
          WHERE id = $6 AND status = 'draft' RETURNING *`,
        [b.subject ?? null, b.title ?? null, b.body_text ?? null, b.cta_label ?? null, b.cta_url ?? null, id],
      );
      if (!rows[0]) return reply.code(409).send({ error: "só rascunhos podem ser editados" });
      return reply.send({ campaign: rows[0] });
    });

    scope.delete("/admin/marketing/campaigns/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const id = Number((req.params as { id: string }).id);
      await pool.query(`DELETE FROM marketing_campaigns WHERE id = $1 AND status IN ('draft','done','failed')`, [id]);
      return reply.send({ ok: true });
    });

    // Envia um TESTE só pra você antes do disparo real.
    scope.post("/admin/marketing/campaigns/:id/test", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      if (!emailEnabled()) return reply.code(503).send({ error: "configure RESEND_API_KEY primeiro" });
      const id = Number((req.params as { id: string }).id);
      const body = req.body as { to?: string };
      const to = (body?.to ?? "").trim();
      if (!isValidEmail(to)) return reply.code(400).send({ error: "informe um e-mail de teste válido" });
      const { rows } = await pool.query<MktCampaignRow>(`SELECT * FROM marketing_campaigns WHERE id = $1`, [id]);
      const c = rows[0];
      if (!c) return reply.code(404).send({ error: "not found" });
      await sendEmail({
        to,
        subject: `[TESTE] ${c.subject}`,
        html: renderCampaignEmail(c, "teste"),
      });
      return reply.send({ ok: true });
    });

    // Dispara pra TODOS os inscritos (roda em fila, com ritmo).
    scope.post("/admin/marketing/campaigns/:id/send", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      if (!emailEnabled()) return reply.code(503).send({ error: "configure RESEND_API_KEY primeiro" });
      const id = Number((req.params as { id: string }).id);
      const { rows } = await pool.query<MktCampaignRow>(
        `SELECT * FROM marketing_campaigns WHERE id = $1`,
        [id],
      );
      const c = rows[0];
      if (!c) return reply.code(404).send({ error: "not found" });
      if (c.status !== "draft") return reply.code(409).send({ error: "campanha já enviada ou em envio" });

      const { rows: cnt } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM marketing_contacts WHERE subscribed = true`,
      );
      const total = Number(cnt[0]?.n ?? "0");
      if (total === 0) return reply.code(400).send({ error: "nenhum contato inscrito na base" });

      await pool.query(`UPDATE marketing_campaigns SET status = 'sending', total = $1 WHERE id = $2`, [total, id]);
      await marketingQueue.add(
        "send",
        { campaignId: id },
        { jobId: marketingJobId(id), removeOnComplete: true, removeOnFail: 10 },
      );
      logger.info({ campaignId: id, total }, "mkt: campanha enfileirada");
      return reply.send({ ok: true, total });
    });
  });
}

// ===== Execução do envio (chamado pelo worker) =====
export async function runMarketingSend(campaignId: number): Promise<void> {
  const { rows } = await pool.query<MktCampaignRow>(
    `SELECT * FROM marketing_campaigns WHERE id = $1 AND status = 'sending'`,
    [campaignId],
  );
  const c = rows[0];
  if (!c) return;

  const { rows: contacts } = await pool.query<ContactRow>(
    `SELECT * FROM marketing_contacts WHERE subscribed = true ORDER BY id ASC`,
  );

  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    try {
      await sendEmail({
        to: contact.email,
        subject: c.subject,
        html: renderCampaignEmail(c, contact.unsubscribe_token),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl(contact.unsubscribe_token)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch (err) {
      failed++;
      logger.warn({ err, email: contact.email, campaignId }, "mkt: envio falhou pra contato");
    }
    // ritmo: ~90/min — respeita rate da API e melhora entregabilidade
    await new Promise((r) => setTimeout(r, 650));
    if ((sent + failed) % 20 === 0) {
      await pool.query(`UPDATE marketing_campaigns SET sent = $1, failed = $2 WHERE id = $3`, [sent, failed, campaignId]);
    }
  }

  await pool.query(
    `UPDATE marketing_campaigns SET status = $1, sent = $2, failed = $3, sent_at = now() WHERE id = $4`,
    [failed > 0 && sent === 0 ? "failed" : "done", sent, failed, campaignId],
  );
  logger.info({ campaignId, sent, failed }, "mkt: campanha concluída");
}
