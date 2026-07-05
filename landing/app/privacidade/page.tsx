import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidade · Vita OS",
  robots: { index: true },
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1. Quem somos",
    body: [
      `A Vita OS (${SITE.domain}) é uma plataforma de atendimento e vendas com inteligência artificial no WhatsApp, voltada a imobiliárias, corretores, consórcios e operações de crédito. Esta política explica, em linguagem direta, como tratamos dados pessoais — em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).`,
    ],
  },
  {
    title: "2. Que dados tratamos",
    body: [
      "Dados de clientes da plataforma (você): nome, e-mail, telefone e dados de faturamento, usados para operar sua conta e prestar suporte.",
      "Dados de leads dos nossos clientes: quando um lead conversa com a IA no WhatsApp de um cliente, tratamos o conteúdo dessas conversas e as informações que o próprio lead fornece (nome, interesse, faixa de renda declarada etc.) exclusivamente para operar o atendimento daquele cliente. Nesse cenário, nosso cliente é o controlador dos dados e a Vita OS atua como operadora.",
    ],
  },
  {
    title: "3. Para que usamos",
    body: [
      "Operar o atendimento automatizado (responder, qualificar e agendar), organizar o funil de vendas do cliente e gerar métricas da própria operação.",
      "Não vendemos dados pessoais. Não compartilhamos dados de leads entre clientes diferentes. Não usamos as conversas dos seus leads para nada além da sua operação.",
    ],
  },
  {
    title: "4. Opt-out e prospecção responsável",
    body: [
      "Quem pedir para não receber mensagens (por exemplo, respondendo “pare” ou “não quero receber”) entra automaticamente em uma lista de bloqueio permanente daquela operação e não recebe novas abordagens. Esse mecanismo é nativo da plataforma.",
    ],
  },
  {
    title: "5. Armazenamento e segurança",
    body: [
      "Os dados ficam em servidores com acesso restrito, criptografia em trânsito e registro de acesso. Conversas e cadastros são mantidos enquanto a conta do cliente estiver ativa ou enquanto houver obrigação legal de retenção; depois disso, são excluídos ou anonimizados.",
    ],
  },
  {
    title: "6. Seus direitos (LGPD)",
    body: [
      `Titulares de dados podem solicitar a qualquer momento: confirmação de tratamento, acesso, correção, anonimização, portabilidade ou exclusão de seus dados, pelo e-mail ${SITE.email}. Respondemos dentro dos prazos da LGPD.`,
      "Se o seu dado foi tratado por um dos nossos clientes (você conversou com o WhatsApp de uma imobiliária, por exemplo), encaminharemos a solicitação ao controlador responsável e apoiaremos o atendimento dela.",
    ],
  },
  {
    title: "7. Alterações e contato",
    body: [
      `Esta política pode ser atualizada — a versão vigente estará sempre nesta página. Dúvidas: ${SITE.email}.`,
    ],
  },
];

export default function PrivacidadePage() {
  return <LegalPage title="Política de Privacidade" sections={SECTIONS} />;
}
