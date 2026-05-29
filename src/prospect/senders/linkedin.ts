import type { Sender, SendResult } from "./index.js";

// Stub manual-assisted: gera msg, retorna deep link. Owner abre LinkedIn e envia
// manualmente; marca como enviado via /admin/prospects/:id/mark-sent.
export const linkedinSender: Sender = {
  async send(_campaign, prospect, _text, _tenant): Promise<SendResult> {
    const slug = prospect.external_id;
    return {
      status: "ready_for_manual",
      deepLink: `https://www.linkedin.com/in/${slug}/`,
    };
  },
};
