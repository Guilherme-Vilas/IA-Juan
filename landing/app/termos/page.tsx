import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso · Vita OS",
  robots: { index: true },
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1. O serviço",
    body: [
      "A Vita OS é uma plataforma de software (SaaS) que automatiza atendimento, qualificação e agendamento de leads via WhatsApp, com painel de gestão (pipeline, agenda, métricas e prospecção). O serviço é prestado no estado em que se encontra, com evolução contínua.",
    ],
  },
  {
    title: "2. Conta e responsabilidades do cliente",
    body: [
      "O cliente é responsável pelas credenciais de acesso, pelo número de WhatsApp conectado e pelo conteúdo das mensagens e regras que configurar na plataforma (tom de voz, informações do negócio, listas de prospecção).",
      "É vedado usar a plataforma para spam indiscriminado, conteúdo ilícito ou abordagens a contatos que tenham pedido para não ser contatados. As proteções nativas (limites de envio, opt-out automático) existem para uso legítimo e não devem ser contornadas.",
    ],
  },
  {
    title: "3. WhatsApp e serviços de terceiros",
    body: [
      "O WhatsApp é um serviço de terceiro (Meta). Bloqueios ou restrições de número podem ocorrer por decisão da Meta e fogem ao controle da Vita OS — nossas proteções reduzem esse risco, mas não o eliminam. O cliente reconhece essa condição ao usar o serviço.",
    ],
  },
  {
    title: "4. Conteúdo gerado por IA",
    body: [
      "As respostas da IA seguem as regras e informações configuradas pelo cliente, que deve revisar essas configurações e acompanhar as conversas pelo painel. A Vita OS não garante resultado comercial específico (número de vendas ou agendamentos).",
    ],
  },
  {
    title: "5. Pagamento, cancelamento e dados",
    body: [
      "Planos e créditos são cobrados conforme contratado, sem fidelidade. O cliente pode cancelar a qualquer momento; após o cancelamento, disponibilizamos exportação dos dados da conta por 30 dias, e em seguida eles são excluídos conforme a Política de Privacidade.",
    ],
  },
  {
    title: "6. Contato",
    body: [`Dúvidas sobre estes termos: ${SITE.email}.`],
  },
];

export default function TermosPage() {
  return <LegalPage title="Termos de Uso" sections={SECTIONS} />;
}
