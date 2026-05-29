import { checkWhatsappNumbers, sendText } from "../../core/evolution.js";
import { getLead } from "../../core/db.js";
import { logger } from "../../core/logger.js";
import type { TenantRow } from "../../core/tenants.js";
import type { Sender, SendResult } from "./index.js";

export const whatsappSender: Sender = {
  async send(_campaign, prospect, text, tenant): Promise<SendResult> {
    const waId = prospect.external_id;

    // anti-duplicação: se já é lead ativo no funil DESSE tenant, não manda outreach por cima
    const existing = await getLead(tenant.id, waId);
    if (existing && existing.status === "open") {
      return { status: "skipped", reason: "já é lead ativo (open)" };
    }

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
