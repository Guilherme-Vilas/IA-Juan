import { upsertLead, updateLead, logMessage, type Slots } from "../core/db.js";
import { logger } from "../core/logger.js";
import { config } from "../config.js";
import { redis, keys } from "../core/redis.js";
import { sendText } from "../core/evolution.js";
import type { TenantRow } from "../core/tenants.js";
import { findProspectByExternalId, getCampaignById, updateProspect, logProspectEvent } from "./repo.js";
import { listSendTexts } from "./steps.js";
import { addToBlacklist, detectOptOut, OPTOUT_CONFIRMATION } from "./suppression.js";
import { classifyReply } from "./classify.js";

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

  const campaign = await getCampaignById(prospect.campaign_id);

  const slots: Slots = {};
  const resolvedNome = prospect.nome?.trim() || pushName?.trim() || null;
  if (resolvedNome) {
    slots.nome = resolvedNome;
  }

  const obsParts: string[] = [];
  if (campaign?.name) obsParts.push(`Campanha: ${campaign.name}`);
  if (prospect.empresa) obsParts.push(`Empresa: ${prospect.empresa}`);
  if (prospect.cargo) obsParts.push(`Cargo: ${prospect.cargo}`);
  if (obsParts.length > 0) {
    slots.observacoes = obsParts.join(" · ");
  }

  const lead = await upsertLead(tenant.id, waId, {
    nome: resolvedNome,
    source: `campaign:${prospect.campaign_id}`,
    state: "S1_DESCOBERTA",
    slots,
  });

  // Se o lead já existia em S0_ABERTURA, move para S1_DESCOBERTA já que a abordagem inicial já ocorreu
  if (lead.state === "S0_ABERTURA") {
    await updateLead(tenant.id, waId, {
      state: "S1_DESCOBERTA",
      slots: { ...lead.slots, ...slots },
      nome: resolvedNome ?? lead.nome,
    }).catch(() => undefined);
  }

  // Abordagens enviadas: busca da tabela prospect_sends com fallback para a mensagem composta ou template
  let sends = await listSendTexts(prospect.id).catch(() => [] as string[]);
  if (sends.length === 0 && prospect.composed_message) {
    sends = [prospect.composed_message];
  }
  if (sends.length === 0 && campaign?.template_text) {
    sends = [campaign.template_text];
  }

  // 1. Grava no banco Postgres (messages) para o painel/corretor ver a conversa completa
  for (const sendText of sends) {
    await logMessage(lead.id, "out", "assistant", sendText).catch(() => undefined);
  }

  // 2. MEMÓRIA DA IA (Redis): injeta as abordagens no leadHistory do Redis.
  // Garante que quando o turno da IA executar no webhook, o histórico de conversa
  // já conterá o texto que o operador enviou, posicionado antes da resposta do usuário.
  try {
    const k = keys.leadHistory(tenant.slug, waId);
    const existingRaw = await redis.lrange(k, 0, -1).catch(() => [] as string[]);
    const existingTexts = new Set(
      existingRaw
        .map((x) => {
          try {
            return (JSON.parse(x) as { content?: string }).content;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );

    for (const sendText of sends) {
      if (!existingTexts.has(sendText)) {
        await redis.rpush(k, JSON.stringify({ role: "assistant", content: sendText }));
        existingTexts.add(sendText);
      }
    }
    await redis.ltrim(k, -16, -1);
    await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, tenant: tenant.slug, waId }, "prospect handoff: falha ao sincronizar memória Redis");
  }

  await updateProspect(prospect.id, {
    status: "replied",
    replied_at: new Date(),
    lead_id: lead.id,
    next_step_at: null,
  });
  await logProspectEvent(prospect.id, "replied", { leadId: lead.id });

  // Classificação da resposta com IA — fire-and-forget: alimenta a métrica de
  // resposta POSITIVA por campanha/variante e serve de rede extra de opt-out
  // (frases que o regex não pega). Não atrasa o webhook nem a Stella.
  void classifyReply(text)
    .then(async (klass) => {
      if (!klass) return;
      await updateProspect(prospect.id, { reply_class: klass });
      await logProspectEvent(prospect.id, "reply_classified", { class: klass });
      if (klass === "opt_out") {
        await addToBlacklist(tenant.id, waId, "opt_out", `campaign:${prospect.campaign_id}`);
        await updateProspect(prospect.id, { status: "opted_out" });
        logger.info({ tenant: tenant.slug, waId, prospectId: prospect.id }, "opt-out via classificação IA → blacklist");
      }
    })
    .catch((err) => logger.warn({ err, prospectId: prospect.id }, "classificação de resposta falhou"));

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
