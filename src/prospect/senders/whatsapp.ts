import fs from "node:fs/promises";
import path from "node:path";
import { checkWhatsappNumbers, sendText, sendMedia, sendAudio } from "../../core/evolution.js";
import { config } from "../../config.js";
import { logger } from "../../core/logger.js";
import type { TenantRow } from "../../core/tenants.js";
import type { StepMediaType } from "../steps.js";
import type { Sender, SendResult } from "./index.js";

// Envio de passo COM mídia: imagem/vídeo/documento vão com o texto como
// legenda (1 mensagem); áudio vai como voz e o texto segue em separado.
export async function sendWhatsappWithMedia(
  tenant: TenantRow,
  waId: string,
  text: string,
  media: { type: StepMediaType; ref: string; name: string },
): Promise<SendResult> {
  const checks = await checkWhatsappNumbers(tenant, [waId]);
  if (!checks.get(waId)) {
    return { status: "skipped", reason: "número sem WhatsApp" };
  }

  let base64: string;
  try {
    // ref é sempre "<tenantId>/<hash>.<ext>" — resolve dentro do MEDIA_DIR.
    const filePath = path.join(config.MEDIA_DIR, media.ref);
    base64 = (await fs.readFile(filePath)).toString("base64");
  } catch (err) {
    logger.error({ err, ref: media.ref, tenant: tenant.slug }, "mídia do passo não encontrada — enviando só o texto");
    try {
      await sendText(tenant, waId, text);
      return { status: "sent" };
    } catch (err2) {
      return { status: "failed", error: (err2 as Error).message ?? String(err2) };
    }
  }

  try {
    if (media.type === "audio") {
      await sendAudio(tenant, waId, base64);
      if (text.trim()) await sendText(tenant, waId, text);
    } else {
      await sendMedia(tenant, waId, {
        mediatype: media.type,
        base64,
        fileName: media.name,
        caption: text.trim() || undefined,
      });
    }
    return { status: "sent" };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    logger.error({ err, tenant: tenant.slug, waId }, "prospect whatsapp media send failed");
    return { status: "failed", error: msg };
  }
}

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
