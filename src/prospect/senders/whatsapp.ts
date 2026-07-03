import { checkWhatsappNumbers, sendText } from "../../core/evolution.js";
import { logger } from "../../core/logger.js";
import type { TenantRow } from "../../core/tenants.js";
import type { Sender, SendResult } from "./index.js";

// Supressão (blacklist, lead do funil, opt-out) roda ANTES, no worker,
// via checkSendSuppression — aqui só valida o número e envia.
export const whatsappSender: Sender = {
  async send(_campaign, prospect, text, tenant): Promise<SendResult> {
    const waId = prospect.external_id;

    const checks = await checkWhatsappNumbers(tenant, [waId]);
    if (!checks.get(waId)) {
      return { status: "skipped", reason: "número sem WhatsApp" };
    }

    try {
      await sendText(tenant, waId, text);
      return { status: "sent" };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      logger.error({ err, tenant: tenant.slug, waId, prospectId: prospect.id }, "prospect whatsapp send failed");
      return { status: "failed", error: msg };
    }
  },
};
