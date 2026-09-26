import crypto from "node:crypto";
import { Queue, Worker } from "bullmq";
import { pool } from "./db.js";
import { bullConnection } from "./redis.js";
import { logger } from "./logger.js";

// Webhooks de saída: emitEvent() enfileira, o worker entrega com assinatura
// HMAC (header x-vita-signature) e retry exponencial. Falha nunca afeta o fluxo
// que emitiu o evento.

export type OutboundEvent =
  | "lead.created"
  | "lead.scheduled"
  | "lead.won"
  | "lead.lost"
  | "appointment.no_show";

export const OUTBOUND_EVENTS: OutboundEvent[] = [
  "lead.created",
  "lead.scheduled",
  "lead.won",
  "lead.lost",
  "appointment.no_show",
];

export type WebhookRow = {
  id: number;
  tenant_id: number;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  last_ok_at: Date | null;
  last_error: string;
  created_at: Date;
};

type DeliverJob = { webhookId: number; event: OutboundEvent; payload: Record<string, unknown> };

export const webhookQueue = new Queue<DeliverJob>("webhook-deliver", bullConnection);

// ===== CRUD =====
export async function listWebhooks(tenantId: number): Promise<WebhookRow[]> {
  const { rows } = await pool.query<WebhookRow>(
    `SELECT * FROM tenant_webhooks WHERE tenant_id = $1 ORDER BY id ASC`,
    [tenantId],
  );
  return rows;
}

export async function createWebhook(
  tenantId: number,
  url: string,
  events: string[],
): Promise<{ ok: boolean; error?: string; webhook?: WebhookRow }> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "url inválida" };
  } catch {
    return { ok: false, error: "url inválida" };
  }
  const clean = events.filter((e): e is OutboundEvent => (OUTBOUND_EVENTS as string[]).includes(e));
  if (!clean.length) return { ok: false, error: "escolha ao menos 1 evento" };
  const count = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM tenant_webhooks WHERE tenant_id = $1`,
    [tenantId],
  );
  if (Number(count.rows[0]?.n ?? 0) >= 10) return { ok: false, error: "máximo de 10 webhooks por conta" };
  const secret = crypto.randomBytes(24).toString("hex");
  const { rows } = await pool.query<WebhookRow>(
    `INSERT INTO tenant_webhooks (tenant_id, url, secret, events) VALUES ($1,$2,$3,$4) RETURNING *`,
    [tenantId, url, secret, clean],
  );
  return { ok: true, webhook: rows[0]! };
}

export async function deleteWebhook(tenantId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM tenant_webhooks WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function setWebhookEnabled(tenantId: number, id: number, enabled: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE tenant_webhooks SET enabled = $1 WHERE id = $2 AND tenant_id = $3`,
    [enabled, id, tenantId],
  );
  return (rowCount ?? 0) > 0;
}

// ===== Emissão =====
export async function emitEvent(
  tenantId: number,
  event: OutboundEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM tenant_webhooks WHERE tenant_id = $1 AND enabled = true AND $2 = ANY(events)`,
      [tenantId, event],
    );
    if (!rows.length) return;
    const body = { event, tenant_id: tenantId, at: new Date().toISOString(), data: payload };
    for (const r of rows) {
      await webhookQueue.add(
        "deliver",
        { webhookId: r.id, event, payload: body },
        { attempts: 5, backoff: { type: "exponential", delay: 60_000 }, removeOnComplete: true, removeOnFail: 100 },
      );
    }
  } catch (err) {
    logger.warn({ err, tenantId, event }, "webhook: emit falhou (fluxo segue)");
  }
}

// ===== Entrega (worker) =====
export function startWebhookWorker(): Worker<DeliverJob> {
  const worker = new Worker<DeliverJob>(
    "webhook-deliver",
    async (job) => {
      const { webhookId, payload } = job.data;
      const { rows } = await pool.query<WebhookRow>(`SELECT * FROM tenant_webhooks WHERE id = $1`, [webhookId]);
      const hook = rows[0];
      if (!hook || !hook.enabled) return;

      const raw = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", hook.secret).update(raw).digest("hex");
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-vita-event": String(job.data.event),
            "x-vita-signature": `sha256=${signature}`,
          },
          body: raw,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await pool.query(`UPDATE tenant_webhooks SET last_ok_at = now(), last_error = '' WHERE id = $1`, [hook.id]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await pool
          .query(`UPDATE tenant_webhooks SET last_error = $1 WHERE id = $2`, [msg.slice(0, 300), hook.id])
          .catch(() => undefined);
        throw err; // BullMQ re-tenta com backoff
      } finally {
        clearTimeout(timeout);
      }
    },
    { ...bullConnection, concurrency: 4 },
  );
  worker.on("ready", () => logger.info("webhook-deliver worker ready"));
  worker.on("failed", (job, err) =>
    logger.warn({ err: err?.message, jobId: job?.id, attempt: job?.attemptsMade }, "webhook delivery failed"),
  );
  return worker;
}
