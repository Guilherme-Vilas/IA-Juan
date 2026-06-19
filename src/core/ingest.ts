import crypto from "node:crypto";
import { pool } from "./db.js";
import { logger } from "./logger.js";
import { upsertLead, getLead } from "./db.js";
import { getTenantById, invalidateTenantsCache, type TenantRow } from "./tenants.js";
import { autoAssignNewLead } from "./crm.js";
import { syncLeadStage } from "./pipeline.js";
import { setLeadCustomFields } from "./custom-fields.js";
import { sendText } from "./evolution.js";

// ===== Token de ingestao =====
export async function ensureIngestToken(tenantId: number): Promise<string> {
  const { rows } = await pool.query<{ ingest_token: string | null }>(
    `SELECT ingest_token FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (rows[0]?.ingest_token) return rows[0].ingest_token;
  const token = crypto.randomBytes(18).toString("base64url");
  await pool.query(`UPDATE tenants SET ingest_token = $1 WHERE id = $2`, [token, tenantId]);
  await invalidateTenantsCache();
  return token;
}

export async function rotateIngestToken(tenantId: number): Promise<string> {
  const token = crypto.randomBytes(18).toString("base64url");
  await pool.query(`UPDATE tenants SET ingest_token = $1 WHERE id = $2`, [token, tenantId]);
  await invalidateTenantsCache();
  return token;
}

export async function getTenantByIngestToken(token: string): Promise<TenantRow | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM tenants WHERE ingest_token = $1`,
    [token],
  );
  if (!rows[0]) return null;
  return getTenantById(rows[0].id);
}

// Normaliza telefone -> wa_id (so digitos, com DDI BR quando ausente).
function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export type IngestPayload = {
  phone?: string;
  wa_id?: string;
  name?: string;
  source?: string;
  // utm_source/medium/campaign/term/content + qualquer extra viram source_detail.
  utm?: Record<string, unknown>;
  custom?: Record<string, unknown>;
};

export type IngestResult = { ok: boolean; wa_id?: string; created?: boolean; error?: string };

// Cria/atualiza um lead a partir de uma fonte externa (form, Meta Lead Ads via
// Zapier/Make, site...). Atribui via round-robin e posiciona na pipeline.
export async function ingestLead(token: string, payload: IngestPayload): Promise<IngestResult> {
  const tenant = await getTenantByIngestToken(token);
  if (!tenant) return { ok: false, error: "token inválido" };

  const waId = payload.wa_id?.replace(/\D/g, "") || (payload.phone ? normalizePhone(payload.phone) : null);
  if (!waId) return { ok: false, error: "telefone/wa_id obrigatório" };

  const existing = await getLead(tenant.id, waId);
  const created = !existing;

  // upsert basico (nome + source). source guarda o canal; detalhe vai em source_detail.
  await upsertLead(tenant.id, waId, {
    nome: payload.name?.trim() || existing?.nome || null,
    source: payload.source?.trim() || existing?.source || "captura",
  });
  const lead = (await getLead(tenant.id, waId))!;

  // source_detail (utm + extras) e custom fields.
  const detail = { ...(payload.utm ?? {}) };
  if (Object.keys(detail).length) {
    await pool.query(
      `UPDATE leads SET source_detail = source_detail || $1::jsonb, updated_at = now() WHERE id = $2`,
      [JSON.stringify(detail), lead.id],
    );
  }
  if (payload.custom && Object.keys(payload.custom).length) {
    await setLeadCustomFields(tenant.id, waId, payload.custom).catch(() => undefined);
  }

  // round-robin + posiciona na pipeline (fase atual).
  await autoAssignNewLead(tenant.id, lead.id, tenant.lead_distribution).catch(() => undefined);
  await syncLeadStage(tenant.id, lead.id, lead.state, { actor: "system", reason: "lead capturado" }).catch(
    () => undefined,
  );

  // saudacao opcional no WhatsApp (so em lead novo, pra nao re-saudar).
  if (created && tenant.capture_greeting?.trim()) {
    sendText(tenant, waId, tenant.capture_greeting.trim()).catch((err) =>
      logger.warn({ err, tenant: tenant.slug, waId }, "ingest: greeting falhou"),
    );
  }

  // Automacoes: dispara cadencia de lead novo (best-effort).
  if (created) {
    const { fireTrigger } = await import("./automations.js");
    await fireTrigger(tenant.id, "lead_created", lead.id).catch(() => undefined);
  }

  logger.info({ tenant: tenant.slug, waId, created, source: payload.source }, "ingest: lead capturado");
  return { ok: true, wa_id: waId, created };
}
