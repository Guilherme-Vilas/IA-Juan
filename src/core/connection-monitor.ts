import { pool } from "./db.js";
import { redis } from "./redis.js";
import { logger } from "./logger.js";
import { getConnectionState } from "./evolution.js";
import { config } from "../config.js";
import { emailEnabled, renderEmail, sendEmail } from "./email.js";
import type { TenantRow } from "./tenants.js";

// Monitor da conexão WhatsApp por tenant, alimentado pelo CONNECTION_UPDATE do
// webhook (fonte de verdade em tempo real) com fallback pro poll da Evolution.
//
// Por que e-mail: quando o chip cai, TODOS os alertas por WhatsApp caem junto
// (saem pela mesma instância). O e-mail é o canal que sobrevive à queda.

const STATE_KEY = (tenantId: number) => `waconn:${tenantId}`; // estado via webhook (sem TTL)
const CACHE_KEY = (tenantId: number) => `wastate:${tenantId}`; // cache do painel (20s)
const ALERT_KEY = (tenantId: number) => `waconn:alerted:${tenantId}`;
const ALERT_DEDUPE_S = 6 * 3600; // no máx 1 e-mail de queda a cada 6h

async function ownerEmails(tenantId: number): Promise<string[]> {
  const { rows } = await pool.query<{ email: string }>(
    `SELECT u.email FROM users u
       JOIN user_tenants ut ON ut.user_id = u.id
      WHERE ut.tenant_id = $1 AND ut.role IN ('owner','admin') AND u.active = true`,
    [tenantId],
  );
  return rows.map((r) => r.email);
}

// Recebe o CONNECTION_UPDATE do webhook. Atualiza o estado e alerta na transição.
export async function handleConnectionUpdate(tenant: TenantRow, state: string): Promise<void> {
  const normalized = state === "open" ? "open" : state === "connecting" ? "connecting" : "close";
  await redis.set(STATE_KEY(tenant.id), normalized).catch(() => undefined);
  await redis.set(CACHE_KEY(tenant.id), normalized, "EX", 20).catch(() => undefined);
  logger.info({ tenant: tenant.slug, state: normalized }, "whatsapp: connection update");

  if (normalized === "close") {
    // Dedupe do alerta: "connecting" durante reconexão não alerta; só "close".
    const first = await redis.set(ALERT_KEY(tenant.id), "1", "EX", ALERT_DEDUPE_S, "NX").catch(() => null);
    if (first !== "OK") return;
    if (!emailEnabled()) {
      logger.warn({ tenant: tenant.slug }, "whatsapp caiu e RESEND_API_KEY ausente — sem canal de alerta externo");
      return;
    }
    const emails = await ownerEmails(tenant.id).catch(() => [] as string[]);
    if (!emails.length) return;
    await sendEmail({
      to: emails,
      subject: `⚠️ WhatsApp desconectado — ${tenant.name}`,
      html: renderEmail({
        title: "Seu WhatsApp desconectou",
        bodyHtml:
          `A instância <strong style="color:#E6E6E6">${tenant.name}</strong> perdeu a conexão com o WhatsApp.<br><br>` +
          `Enquanto estiver assim, a IA não recebe nem responde mensagens, e as campanhas ficam pausadas automaticamente.<br><br>` +
          `Abra o painel e escaneie o QR code para reconectar.`,
        cta: { label: "Reconectar agora", url: `${config.APP_PUBLIC_URL}/leads` },
      }),
    }).catch((err) => logger.error({ err, tenant: tenant.slug }, "alerta de desconexão: e-mail falhou"));
  }

  if (normalized === "open") {
    const wasAlerted = await redis.del(ALERT_KEY(tenant.id)).catch(() => 0);
    if (wasAlerted && emailEnabled()) {
      const emails = await ownerEmails(tenant.id).catch(() => [] as string[]);
      if (emails.length) {
        await sendEmail({
          to: emails,
          subject: `✅ WhatsApp reconectado — ${tenant.name}`,
          html: renderEmail({
            title: "WhatsApp reconectado",
            bodyHtml: `A instância <strong style="color:#E6E6E6">${tenant.name}</strong> voltou a ficar online. Campanhas e IA seguem normalmente.`,
          }),
        }).catch(() => undefined);
      }
    }
  }
}

// Estado atual: prioriza o que o webhook informou; sem informação, consulta a
// Evolution (e cacheia). Usado pra pausar campanhas/follow-ups com chip caído.
export async function isWhatsappConnected(tenant: TenantRow): Promise<boolean> {
  try {
    const fromEvents = await redis.get(STATE_KEY(tenant.id));
    if (fromEvents) return fromEvents === "open";
    const cached = await redis.get(CACHE_KEY(tenant.id));
    if (cached) return cached === "open";
  } catch {
    /* segue pro poll */
  }
  const state = await getConnectionState(tenant).catch(() => "unknown");
  await redis.set(CACHE_KEY(tenant.id), state, "EX", 20).catch(() => undefined);
  // "unknown" (Evolution fora do ar) NÃO pausa nada — fail-open.
  return state !== "close";
}
