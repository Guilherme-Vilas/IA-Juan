import { pool } from "./db.js";
import { logger } from "./logger.js";
import { invalidateTenantsCache } from "./tenants.js";
import type { TenantRole } from "./users.js";

// ===== Membros do tenant (vendedores) =====
export type TenantMember = {
  user_id: number;
  name: string;
  email: string;
  role: TenantRole;
};

// Vendedores elegiveis a receber lead (exclui 'viewer', que so observa).
const SALES_ROLES = ["owner", "admin", "sdr"];

export async function listTenantMembers(tenantId: number): Promise<TenantMember[]> {
  const { rows } = await pool.query<TenantMember>(
    `SELECT ut.user_id, u.name, u.email, ut.role
       FROM user_tenants ut
       JOIN users u ON u.id = ut.user_id
      WHERE ut.tenant_id = $1 AND u.active = true
      ORDER BY u.name ASC, u.id ASC`,
    [tenantId],
  );
  return rows;
}

async function salesMembers(tenantId: number): Promise<TenantMember[]> {
  return (await listTenantMembers(tenantId)).filter((m) => SALES_ROLES.includes(m.role));
}

// ===== Round-robin =====
// Le o ponteiro fresco do banco (nao o cache de 60s) pra nao repetir o mesmo
// vendedor dentro da janela de cache. Distribuicao eventual e o suficiente.
export async function pickNextAssignee(tenantId: number): Promise<number | null> {
  const members = await salesMembers(tenantId);
  if (members.length === 0) return null;
  const ordered = [...members].sort((a, b) => a.user_id - b.user_id);

  const { rows } = await pool.query<{ last_assigned_user_id: number | null }>(
    `SELECT last_assigned_user_id FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const last = rows[0]?.last_assigned_user_id ?? null;
  const idx = ordered.findIndex((m) => m.user_id === last);
  const next = ordered[(idx + 1) % ordered.length]!;

  await pool.query(`UPDATE tenants SET last_assigned_user_id = $1 WHERE id = $2`, [next.user_id, tenantId]);
  await invalidateTenantsCache();
  return next.user_id;
}

export async function assignLead(
  tenantId: number,
  waId: string,
  userId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  if (userId != null) {
    const members = await salesMembers(tenantId);
    if (!members.some((m) => m.user_id === userId)) {
      return { ok: false, error: "usuário não é vendedor deste tenant" };
    }
  }
  const { rowCount } = await pool.query(
    `UPDATE leads SET assigned_user_id = $1, updated_at = now() WHERE tenant_id = $2 AND wa_id = $3`,
    [userId, tenantId, waId],
  );
  return (rowCount ?? 0) > 0 ? { ok: true } : { ok: false, error: "lead not found" };
}

// Auto-atribui um lead recem-criado quando o tenant esta em round-robin e o lead
// ainda nao tem dono. Best-effort — chamado no fluxo de mensagem (fsm).
export async function autoAssignNewLead(
  tenantId: number,
  leadId: number,
  distribution: string | undefined,
): Promise<void> {
  if (distribution !== "round_robin") return;
  const cur = await pool.query<{ assigned_user_id: number | null }>(
    `SELECT assigned_user_id FROM leads WHERE id = $1`,
    [leadId],
  );
  if (cur.rows[0]?.assigned_user_id != null) return;
  const userId = await pickNextAssignee(tenantId);
  if (userId == null) return;
  await pool.query(`UPDATE leads SET assigned_user_id = $1, updated_at = now() WHERE id = $2`, [userId, leadId]);
  logger.info({ tenantId, leadId, userId }, "crm: lead auto-assigned (round-robin)");
}

// ===== Valor do negocio =====
export async function setLeadValue(
  tenantId: number,
  waId: string,
  valueCents: number | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE leads SET value_cents = $1, updated_at = now() WHERE tenant_id = $2 AND wa_id = $3`,
    [valueCents, tenantId, waId],
  );
  return (rowCount ?? 0) > 0;
}

// ===== Distribuicao do tenant =====
export async function setLeadDistribution(tenantId: number, mode: "manual" | "round_robin"): Promise<void> {
  await pool.query(`UPDATE tenants SET lead_distribution = $1, updated_at = now() WHERE id = $2`, [mode, tenantId]);
  await invalidateTenantsCache();
}

// ===== Notas internas =====
export type LeadNote = {
  id: number;
  body: string;
  user_id: number | null;
  author: string | null;
  created_at: Date;
};

export async function addNote(
  tenantId: number,
  waId: string,
  userId: number | null,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "nota vazia" };
  const lead = await pool.query<{ id: number }>(
    `SELECT id FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  if (!lead.rows[0]) return { ok: false, error: "lead not found" };
  await pool.query(
    `INSERT INTO lead_notes (tenant_id, lead_id, user_id, body) VALUES ($1,$2,$3,$4)`,
    [tenantId, lead.rows[0].id, userId, text],
  );
  return { ok: true };
}

export async function listNotes(tenantId: number, waId: string): Promise<LeadNote[]> {
  const { rows } = await pool.query<LeadNote>(
    `SELECT n.id, n.body, n.user_id, u.name AS author, n.created_at
       FROM lead_notes n
       JOIN leads l ON l.id = n.lead_id
       LEFT JOIN users u ON u.id = n.user_id
      WHERE n.tenant_id = $1 AND l.wa_id = $2
      ORDER BY n.created_at DESC
      LIMIT 100`,
    [tenantId, waId],
  );
  return rows;
}
