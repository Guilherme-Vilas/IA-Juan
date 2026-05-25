import { upsertLead, type Slots } from "../core/db.js";
import { logger } from "../core/logger.js";
import { findProspectByExternalId, updateProspect, logProspectEvent } from "./repo.js";

// Quando um waId responde, verifica se ele pertence a algum prospect ativo (sent / ready_for_manual / queued).
// Se sim, vincula resposta ao prospect e cria/atualiza o lead com source='campaign:<id>'.
// Retorna o lead_id (criado ou existente) pra quem chamou propagar.
export async function handleProspectReply(
  waId: string,
  pushName: string | null,
): Promise<{ matched: boolean; leadId?: number; prospectId?: number; campaignId?: number }> {
  const prospect = await findProspectByExternalId(waId);
  if (!prospect) return { matched: false };

  // hidrata o lead com nome/empresa que já temos do CSV
  const slots: Slots = {};
  if (prospect.empresa) slots.observacoes = `Empresa: ${prospect.empresa}${prospect.cargo ? ` · ${prospect.cargo}` : ""}`;

  const lead = await upsertLead(waId, {
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
    { waId, prospectId: prospect.id, campaignId: prospect.campaign_id, leadId: lead.id },
    "prospect replied → handed off to lead",
  );

  return {
    matched: true,
    leadId: lead.id,
    prospectId: prospect.id,
    campaignId: prospect.campaign_id,
  };
}
