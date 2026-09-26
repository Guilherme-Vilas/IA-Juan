import { pool } from "./db.js";
import { logger } from "./logger.js";
import { sendText } from "./evolution.js";
import type { TenantRow } from "./tenants.js";

// Resolve PRA QUEM vai um alerta operacional de um lead: o vendedor atribuído
// (se tiver WhatsApp cadastrado) e senão o dono da conta. Evita o funil de
// "tudo cai no dono" quando há equipe.

export async function assigneeWhatsapp(tenantId: number, leadId: number): Promise<string | null> {
  const { rows } = await pool.query<{ whatsapp_e164: string | null }>(
    `SELECT u.whatsapp_e164
       FROM leads l JOIN users u ON u.id = l.assigned_user_id
      WHERE l.id = $1 AND l.tenant_id = $2 AND u.active = true`,
    [leadId, tenantId],
  );
  const phone = rows[0]?.whatsapp_e164?.trim();
  return phone ? phone : null;
}

// Envia pro responsável do lead; sem responsável (ou sem telefone), vai pro dono.
export async function notifyLeadOwner(tenant: TenantRow, leadId: number, text: string): Promise<void> {
  const assignee = await assigneeWhatsapp(tenant.id, leadId).catch(() => null);
  const to = assignee ?? tenant.owner_whatsapp_e164;
  if (!to) return;
  try {
    await sendText(tenant, to, text);
  } catch (err) {
    logger.error({ err, tenant: tenant.slug, leadId }, "notifyLeadOwner failed");
    // fallback: se o alvo era o vendedor e falhou, tenta o dono
    if (assignee && tenant.owner_whatsapp_e164 && assignee !== tenant.owner_whatsapp_e164) {
      await sendText(tenant, tenant.owner_whatsapp_e164, text).catch(() => undefined);
    }
  }
}
