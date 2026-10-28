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

// Número padrão dos alertas operacionais: o dedicado configurado no painel
// (Configurações → Alertas) e, vazio, o dono. Null = alertas desligados.
export function alertTarget(tenant: TenantRow): string | null {
  if (tenant.alerts_enabled === false) return null;
  const dedicated = tenant.alert_whatsapp_e164?.trim();
  return dedicated || tenant.owner_whatsapp_e164 || null;
}

// Envia pro responsável do lead; sem responsável (ou sem telefone), vai pro
// número de alertas. Toggle desligado no painel silencia tudo por aqui.
export async function notifyLeadOwner(tenant: TenantRow, leadId: number, text: string): Promise<void> {
  if (tenant.alerts_enabled === false) {
    logger.info({ tenant: tenant.slug, leadId }, "alerta suprimido: alertas desativados nas Configurações");
    return;
  }
  const assignee = await assigneeWhatsapp(tenant.id, leadId).catch(() => null);
  const fallback = alertTarget(tenant);
  const to = assignee ?? fallback;
  if (!to) return;
  try {
    await sendText(tenant, to, text);
  } catch (err) {
    logger.error({ err, tenant: tenant.slug, leadId }, "notifyLeadOwner failed");
    // fallback: se o alvo era o vendedor e falhou, tenta o número de alertas
    if (assignee && fallback && assignee !== fallback) {
      await sendText(tenant, fallback, text).catch(() => undefined);
    }
  }
}
