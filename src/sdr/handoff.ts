import { sendText } from "../core/evolution.js";
import { updateLead, type LeadRow, type MeetingChannel } from "../core/db.js";
import { logger } from "../core/logger.js";
import type { TenantRow } from "../core/tenants.js";

function formatSlots(slots: LeadRow["slots"]): string {
  const lines: string[] = [];
  if (slots.nome) lines.push(`• Nome: ${slots.nome}`);
  if (slots.interesse) lines.push(`• Interesse: ${slots.interesse}`);
  if (slots.valor_bem) lines.push(`• Valor do bem: R$ ${slots.valor_bem.toLocaleString("pt-BR")}`);
  if (slots.capacidade_mensal)
    lines.push(`• Capacidade mensal: R$ ${slots.capacidade_mensal.toLocaleString("pt-BR")}`);
  if (slots.prazo_meses) lines.push(`• Prazo: ${slots.prazo_meses} meses`);
  if (slots.intencao_lance !== undefined)
    lines.push(`• Lance: ${slots.intencao_lance ? "sim" : "não/não sabe"}`);
  if (slots.sabe_consorcio !== undefined)
    lines.push(`• Tem clareza do produto: ${slots.sabe_consorcio ? "sim" : "precisa entender"}`);
  if (slots.prazo_decisao) lines.push(`• Timing: ${slots.prazo_decisao}`);
  if (slots.fecha_se_proposta_boa !== undefined)
    lines.push(`• Fecha se proposta adequada: ${slots.fecha_se_proposta_boa ? "sim" : "ainda explorando"}`);
  if (slots.decisao_com_conjuge !== undefined)
    lines.push(`• Decide: ${slots.decisao_com_conjuge ? "com cônjuge/parceiro" : "sozinho(a)"}`);
  if (slots.mora_exterior) lines.push(`• Mora no exterior: sim`);
  if (slots.observacoes) lines.push(`• Obs: ${slots.observacoes}`);
  return lines.length ? lines.join("\n") : "(sem dados coletados)";
}

export async function notifyJuan(tenant: TenantRow, lead: LeadRow, motivo: string) {
  const text =
    `🔔 *Handoff SDR — ${tenant.name}*\n` +
    `Lead: ${lead.nome ?? "(sem nome)"} — wa.me/${lead.wa_id}\n` +
    `Motivo: ${motivo}\n\n` +
    formatSlots(lead.slots);
  try {
    await sendText(tenant, tenant.owner_whatsapp_e164, text);
  } catch (err) {
    logger.error({ err, tenant: tenant.slug }, "notifyJuan failed");
  }
}

export async function pauseAi(tenant: TenantRow, waId: string) {
  // Marca como pausada (única coisa que silencia a IA) e move pra estado HANDOFF
  // pra refletir no dashboard que o owner tá no controle.
  await updateLead(tenant.id, waId, { paused: true, state: "HANDOFF" });
}

export async function notifyScheduled(
  tenant: TenantRow,
  lead: LeadRow,
  whenLabel: string,
  channel: MeetingChannel = "ligacao",
) {
  const channelLabel = channel === "video" ? "📹 Vídeo chamada" : "📞 Ligação";
  const text =
    `✅ *Agendamento confirmado — ${tenant.name}*\n` +
    `Lead: ${lead.nome ?? "(sem nome)"} — wa.me/${lead.wa_id}\n` +
    `Quando: ${whenLabel}\n` +
    `Canal: ${channelLabel}\n\n` +
    formatSlots(lead.slots);
  try {
    await sendText(tenant, tenant.owner_whatsapp_e164, text);
  } catch (err) {
    logger.error({ err, tenant: tenant.slug }, "notifyScheduled failed");
  }
}
