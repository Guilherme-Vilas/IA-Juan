import { pool } from "../core/db.js";
import { redis } from "../core/redis.js";
import { logger } from "../core/logger.js";
import { classifyReply, type ReplyClass } from "./classify.js";
import { addToBlacklist } from "./suppression.js";
import { updateProspect, logProspectEvent } from "./repo.js";

// Ponte entre o webhook (handoff) e o turno da IA (worker):
// o handoff marca "este lead acabou de responder a campanha X"; o primeiro turno
// da IA consome a marca, classifica a resposta e dispara o gatilho
// `campaign_replied`. O disparo fica no turno (DEPOIS do cancelRunsForLead),
// senao a propria resposta cancelaria a cadencia recem-criada (stop_on_reply).

export type CampaignReplyMark = { prospectId: number; campaignId: number };

const MARK_KEY = (tenantSlug: string, waId: string) => `campaign_reply:${tenantSlug}:${waId}`;
const MARK_TTL_S = 24 * 3600;

export async function markCampaignReply(tenantSlug: string, waId: string, mark: CampaignReplyMark): Promise<void> {
  await redis.set(MARK_KEY(tenantSlug, waId), JSON.stringify(mark), "EX", MARK_TTL_S);
}

// Le e apaga numa operacao so — garante um unico disparo por resposta.
export async function consumeCampaignReply(tenantSlug: string, waId: string): Promise<CampaignReplyMark | null> {
  const raw = await redis.getdel(MARK_KEY(tenantSlug, waId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignReplyMark;
  } catch {
    return null;
  }
}

// Classe da resposta do prospect: usa a salva ou classifica agora (modelo fast).
// opt_out via IA vira blacklist (rede extra pras frases que o regex nao pega).
export async function resolveReplyClass(
  tenantId: number,
  waId: string,
  mark: CampaignReplyMark,
  text: string,
): Promise<ReplyClass | null> {
  const cur = await pool.query<{ reply_class: ReplyClass | null }>(
    `SELECT reply_class FROM prospects WHERE id = $1`,
    [mark.prospectId],
  );
  const saved = cur.rows[0]?.reply_class ?? null;
  if (saved) return saved;

  const klass = await classifyReply(text);
  if (!klass) return null;
  await updateProspect(mark.prospectId, { reply_class: klass });
  await logProspectEvent(mark.prospectId, "reply_classified", { class: klass });
  if (klass === "opt_out") {
    await addToBlacklist(tenantId, waId, "opt_out", `campaign:${mark.campaignId}`);
    await updateProspect(mark.prospectId, { status: "opted_out" });
    logger.info({ tenantId, waId, prospectId: mark.prospectId }, "opt-out via classificação IA → blacklist");
  }
  return klass;
}

// Classe da resposta mais recente do lead a uma campanha (pra calibrar o tom).
export async function getLeadReplyClass(leadId: number): Promise<ReplyClass | null> {
  const { rows } = await pool.query<{ reply_class: ReplyClass | null }>(
    `SELECT reply_class FROM prospects
      WHERE lead_id = $1 AND reply_class IS NOT NULL
      ORDER BY replied_at DESC NULLS LAST
      LIMIT 1`,
    [leadId],
  );
  return rows[0]?.reply_class ?? null;
}
