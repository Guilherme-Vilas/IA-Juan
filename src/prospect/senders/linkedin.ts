import type { Sender, SendResult } from "./index.js";

// Stub manual-assisted: o sistema só GERA a mensagem e devolve o link pra Juan abrir
// a conversa no LinkedIn manualmente. Quando ele marcar como enviado no dashboard,
// o status vira "sent" via endpoint dedicado.
//
// Pra trocar por integração automática (Unipile / Chrome ext / scraper):
//   - implementar a chamada externa aqui
//   - retornar { status: "sent" }
// Sem precisar mexer no resto do pipeline.
export const linkedinSender: Sender = {
  async send(_campaign, prospect, _text): Promise<SendResult> {
    const slug = prospect.external_id;
    return {
      status: "ready_for_manual",
      deepLink: `https://www.linkedin.com/in/${slug}/`,
    };
  },
};
