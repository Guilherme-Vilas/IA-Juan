import { upsertLead, type Slots } from "../core/db.js";
import { logger } from "../core/logger.js";
import { sendText } from "../core/evolution.js";
import type { TenantRow } from "../core/tenants.js";
import { findProspectByExternalId, updateProspect, logProspectEvent } from "./repo.js";
import { addToBlacklist, detectOptOut, OPTOUT_CONFIRMATION } from "./suppression.js";

// Quando um waId responde, verifica se ele pertence a algum prospect ativo (sent / ready_for_manual / queued).
// Se sim, vincula resposta ao prospect e cria/atualiza o lead com source='campaign:<id>'.
// Se a resposta for opt-out ("pare", "não me mande mais"...), blacklista o número,
// confirma uma única vez e retorna optedOut=true — o webhook NÃO aciona a IA.
export async function handleProspectReply(
  tenant: TenantRow,
  waId: string,
  pushName: string | null,
  text: string,
): Promise<{ matched: boolean; optedOut?: boolean; leadId?: number; prospectId?: number; campaignId?: number }> {
  const prospect = await findProspectByExternalId(tenant.id, waId);
  if (!prospect) return { matched: false };

  if (detectOptOut(text)) {
    await addToBlacklist(tenant.id, waId, "opt_out", `campaign:${prospect.campaign_id}`);
    await updateProspect(prospect.id, { status: "opted_out", replied_at: new Date() });
    await logProspectEvent(prospect.id, "opted_out", { text: text.slice(0, 200) });
    await sendText(tenant, waId, OPTOUT_CONFIRMATION).catch((err) =>
      logger.warn({ err, tenant: tenant.slug, waId }, "opt-out: confirmação falhou"),
    );
    logger.info(
      { tenant: tenant.slug, waId, prospectId: prospect.id, campaignId: prospect.campaign_id },
      "prospect opt-out → blacklist",
    );
    return { matched: true, optedOut: true, prospectId: prospect.id, campaignId: prospect.campaign_id };
  }

  const slots: Slots = {};
  if (prospect.empresa) {
    slots.observacoes = `Empresa: ${prospect.empresa}${prospect.cargo ? ` · ${prospect.cargo}` : ""}`;
  }

  const lead = await upsertLead(tenant.id, waId, {
    nome: prospect.nome ?? pushName ?? null,
    source: `campaign:${prospect.campaign_id}`,
    slots,
  });

  await updateProspect(prospect.id, {
    status: "replied",
    replied_at: new Date(),
    lead_id: lead.id,
  });
  await logProspectEvent(prospect.id, "replied", { leadId: lead.id });

  logger.info(
    { tenant: tenant.slug, waId, prospectId: prospect.id, campaignId: prospect.campaign_id, leadId: lead.id },
    "prospect replied → handed off to lead",
  );

  return {
    matched: true,
    leadId: lead.id,
    prospectId: prospect.id,
    campaignId: prospect.campaign_id,
  };
}
