import { checkWhatsappNumbers, sendText } from "../../core/evolution.js";
import { getLead } from "../../core/db.js";
import { logger } from "../../core/logger.js";
import type { Sender, SendResult } from "./index.js";

export const whatsappSender: Sender = {
  async send(_campaign, prospect, text): Promise<SendResult> {
    const waId = prospect.external_id;

    // anti-duplicação: se já é lead ativo no funil, não manda outreach por cima
    const existing = await getLead(waId);
    if (existing && existing.status === "open") {
      return { status: "skipped", reason: "já é lead ativo (open)" };
    }

    // verifica se o número tem WhatsApp antes de gastar a mensagem
    const checks = await checkWhatsappNumbers([waId]);
    if (!checks.get(waId)) {
      return { status: "skipped", reason: "número sem WhatsApp" };
    }

    try {
      await sendText(waId, text);
      return { status: "sent" };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      logger.error({ err, waId, prospectId: prospect.id }, "prospect whatsapp send failed");
      return { status: "failed", error: msg };
    }
  },
};
