import { chat } from "../core/llm.js";
import { logger } from "../core/logger.js";
import type { CampaignRow, ProspectRow } from "./repo.js";

// Substitui {{var}} pelos valores do prospect. Vars não encontradas viram string vazia.
export function interpolate(template: string, prospect: ProspectRow): string {
  const lookup: Record<string, string> = {
    nome: prospect.nome ?? "",
    primeiro_nome: (prospect.nome ?? "").split(" ")[0] ?? "",
    empresa: prospect.empresa ?? "",
    cargo: prospect.cargo ?? "",
    ...Object.fromEntries(
      Object.entries(prospect.raw_csv).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, key) => {
    return lookup[key] ?? "";
  });
}

// Llama refine: ajusta tom/naturalidade SEM mudar a estrutura nem inventar fatos.
// Roda no modelo fast (8B) — é uma chamada barata, ~200 tokens.
export async function refineWithAi(
  baseText: string,
  campaign: CampaignRow,
  prospect: ProspectRow,
): Promise<string> {
  const sys = `Você reescreve mensagens de abordagem (cold outreach) em português brasileiro mantendo a INTENÇÃO e os FATOS exatos da versão original.

Regras OBRIGATÓRIAS:
- NÃO invente fatos sobre a pessoa, empresa ou cargo que não estejam no contexto.
- NÃO mude o significado nem o pedido principal da mensagem.
- Ajuste apenas tom (${campaign.tone}), fluência e naturalidade.
- Máximo 2 frases curtas. Sem emojis a menos que já tenha no original.
- Use o primeiro nome se disponível. NÃO use "prezado" nem "caro".
- Responda APENAS com a mensagem reescrita, sem comentário nem aspas.`;

  const ctx = [
    prospect.nome ? `Nome: ${prospect.nome}` : null,
    prospect.empresa ? `Empresa: ${prospect.empresa}` : null,
    prospect.cargo ? `Cargo: ${prospect.cargo}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const user = `Mensagem original:\n${baseText}\n\nContexto do destinatário:\n${ctx || "(sem contexto extra)"}\n\nReescreva:`;

  try {
    const res = await chat({
      model: "fast",
      temperature: 0.5,
      maxTokens: 200,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const out = (res.message.content ?? "").trim();
    if (!out) {
      logger.warn({ prospectId: prospect.id }, "ai refine returned empty, falling back to base text");
      return baseText;
    }
    return out;
  } catch (err) {
    logger.warn({ err, prospectId: prospect.id }, "ai refine failed, falling back to base text");
    return baseText;
  }
}

export async function composeMessage(campaign: CampaignRow, prospect: ProspectRow): Promise<string> {
  return composeWithTemplate(campaign, prospect, campaign.template_text);
}

// Compose com template arbitrário — usado pela cadência (cada passo/variante
// tem seu próprio template; tone/ai_refine continuam sendo da campanha).
export async function composeWithTemplate(
  campaign: CampaignRow,
  prospect: ProspectRow,
  templateText: string,
): Promise<string> {
  const base = interpolate(templateText, prospect);
  if (!campaign.ai_refine) return base;
  return await refineWithAi(base, campaign, prospect);
}
