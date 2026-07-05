// ============================================================================
// CONFIG CENTRAL DO SITE — edite AQUI (e só aqui) os dados reais.
// Tudo que estiver null/vazio simplesmente não aparece na página — nada de
// número fake ou placeholder quebrando a confiança do visitante.
// ============================================================================

export const SITE = {
  name: "Vita OS",
  domain: "systemvita.com.br",
  url: "https://systemvita.com.br",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.systemvita.com.br",
  email: "contato@systemvita.com.br",

  // WhatsApp comercial (só dígitos, com DDI). null = CTAs caem no e-mail.
  // TODO: colocar o número real. Ex: "5541988887777"
  contactWhatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP as string | undefined) ?? null,

  // Número da INSTÂNCIA DEMO da Stella — o visitante conversa com a IA na hora.
  // É o maior gerador de confiança da página. null = seção mostra só a simulação.
  // TODO: provisionar um tenant demo e colocar o número aqui.
  demoWhatsapp: (process.env.NEXT_PUBLIC_DEMO_WHATSAPP as string | undefined) ?? null,

  // Dados de legitimidade do rodapé. null = linha não aparece.
  // TODO: preencher com o CNPJ real da empresa.
  cnpj: (process.env.NEXT_PUBLIC_CNPJ as string | undefined) ?? null,
  instagram: (process.env.NEXT_PUBLIC_INSTAGRAM as string | undefined) ?? null, // ex: "vitaos.br"

  // Analytics — só carregam quando configurados.
  gaId: (process.env.NEXT_PUBLIC_GA_ID as string | undefined) ?? null,
  metaPixelId: (process.env.NEXT_PUBLIC_META_PIXEL_ID as string | undefined) ?? null,
} as const;

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// CTA principal: WhatsApp se configurado, senão e-mail (nunca um número fake).
export function primaryCtaHref(): string {
  return SITE.contactWhatsapp
    ? waLink(SITE.contactWhatsapp, "Olá! Quero conhecer a Vita OS.")
    : `mailto:${SITE.email}?subject=${encodeURIComponent("Quero conhecer a Vita OS")}`;
}
