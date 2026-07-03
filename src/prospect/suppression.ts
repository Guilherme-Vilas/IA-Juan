import { pool } from "../core/db.js";
import { logger } from "../core/logger.js";

// ============================================================================
// Supressão de prospecção — Fase 1.
// Três camadas de proteção antes de qualquer mensagem sair:
//   1. Blacklist do tenant (opt-outs LGPD + bloqueios manuais)
//   2. Já prospectado em outra campanha nos últimos N dias (cross-campanha)
//   3. Já é lead do funil em situação que proíbe outreach (aberto, sem
//      interesse, ganho ou perdido)
// Aplicadas no IMPORT (feedback visível) e re-checadas no ENVIO (estado muda).
// ============================================================================

export const REPROSPECT_WINDOW_DAYS = 90;

export type BlacklistReason = "opt_out" | "manual" | "bounced";

export type BlacklistRow = {
  id: number;
  tenant_id: number;
  external_id: string;
  reason: BlacklistReason;
  source: string | null;
  created_at: Date;
};

export async function addToBlacklist(
  tenantId: number,
  externalId: string,
  reason: BlacklistReason,
  source?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO prospect_blacklist (tenant_id, external_id, reason, source)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, external_id) DO NOTHING`,
    [tenantId, externalId, reason, source ?? null],
  );
}

export async function removeFromBlacklist(tenantId: number, externalId: string): Promise<void> {
  await pool.query(
    `DELETE FROM prospect_blacklist WHERE tenant_id = $1 AND external_id = $2`,
    [tenantId, externalId],
  );
}

export async function listBlacklist(tenantId: number, limit = 500): Promise<BlacklistRow[]> {
  const { rows } = await pool.query<BlacklistRow>(
    `SELECT * FROM prospect_blacklist WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

// ===== Checagens em lote (import) =====

export async function filterBlacklisted(
  tenantId: number,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const { rows } = await pool.query<{ external_id: string }>(
    `SELECT external_id FROM prospect_blacklist
      WHERE tenant_id = $1 AND external_id = ANY($2)`,
    [tenantId, externalIds],
  );
  return new Set(rows.map((r) => r.external_id));
}

// Já recebeu outreach (qualquer campanha do tenant, exceto esta) na janela.
// pending/queued contam sempre (vai receber em breve); enviados contam na janela.
export async function filterRecentlyProspected(
  tenantId: number,
  externalIds: string[],
  excludeCampaignId: number,
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const { rows } = await pool.query<{ external_id: string }>(
    `SELECT DISTINCT external_id FROM prospects
      WHERE tenant_id = $1
        AND external_id = ANY($2)
        AND campaign_id <> $3
        AND (
          status IN ('pending','queued')
          OR (status IN ('sent','ready_for_manual','replied','opted_out')
              AND created_at >= now() - make_interval(days => $4))
        )`,
    [tenantId, externalIds, excludeCampaignId, REPROSPECT_WINDOW_DAYS],
  );
  return new Set(rows.map((r) => r.external_id));
}

// Leads do funil em situação que proíbe outreach:
//   open           → conversa em andamento (Stella ou humano)
//   not_interested → já disse não; insistir é queimar o chip
//   won/lost       → negócio decidido
// (no_response/postponed ficam de fora de propósito: re-engajar é legítimo.)
export async function filterSuppressedLeads(
  tenantId: number,
  waIds: string[],
): Promise<Set<string>> {
  if (waIds.length === 0) return new Set();
  const { rows } = await pool.query<{ wa_id: string }>(
    `SELECT wa_id FROM leads
      WHERE tenant_id = $1
        AND wa_id = ANY($2)
        AND (status = 'open' OR closed_reason = 'not_interested' OR outcome IN ('won','lost'))`,
    [tenantId, waIds],
  );
  return new Set(rows.map((r) => r.wa_id));
}

// ===== Checagem unitária (hora do envio — defesa em profundidade) =====

export async function checkSendSuppression(
  tenantId: number,
  externalId: string,
  channel: "whatsapp" | "linkedin",
): Promise<string | null> {
  const black = await filterBlacklisted(tenantId, [externalId]);
  if (black.has(externalId)) return "blacklist (opt-out/manual)";

  if (channel === "whatsapp") {
    const suppressed = await filterSuppressedLeads(tenantId, [externalId]);
    if (suppressed.has(externalId)) return "lead do funil (aberto/sem interesse/decidido)";
  }
  return null;
}

// ===== Detecção de opt-out em resposta de prospect =====
// Determinística (sem LLM): só roda na resposta de quem É prospect ativo,
// então falso-positivo é raro e o custo de errar é baixo (dá pra tirar da
// blacklist pela API). Fase 2 troca por classificação com IA.

const OPTOUT_PATTERNS: RegExp[] = [
  /\b(para|pare|parem|para de|chega de)\b.{0,30}\b(mensagem|mensagens|msg|me mandar|enviar|mandar)\b/i,
  /\bn[aã]o\s+(me\s+)?(mande|mandem|envie|enviem|chame|chamem|procure|procurem)\b/i,
  /\b(remover?|tira|tirem|retire|retirem|exclui|excluam)\b.{0,20}\b(lista|contato|cadastro)\b/i,
  /\bdescadastr/i,
  /\bn[aã]o\s+quero\s+(receber|mais)\b/i,
  /\bme\s+(exclui|remove|tira)\b/i,
  /^\s*(pare|stop|sair|cancelar)\s*[.!]*\s*$/i,
];

export function detectOptOut(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return OPTOUT_PATTERNS.some((re) => re.test(t));
}

// Confirmação enviada uma única vez ao opt-out (boa prática LGPD).
export const OPTOUT_CONFIRMATION =
  "Entendido, você não vai mais receber mensagens nossas. Qualquer coisa, é só chamar. 👍";

export function logSuppression(
  tenant: { slug: string },
  externalId: string,
  reason: string,
): void {
  logger.info({ tenant: tenant.slug, externalId, reason }, "prospect suprimido");
}
