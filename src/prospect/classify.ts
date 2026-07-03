import { chat } from "../core/llm.js";
import { logger } from "../core/logger.js";

// Classificação da PRIMEIRA resposta de um prospect (cold outreach) — roda
// fire-and-forget no handoff: não segura o webhook nem a Stella.
// Modelo fast, ~10 tokens de saída: custo desprezível, métrica valiosa
// (taxa de resposta POSITIVA por campanha/variante) + rede extra de opt-out.

export const REPLY_CLASSES = ["interessado", "nao_interessado", "depois", "opt_out", "neutro"] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];

const SYSTEM = `Você classifica a primeira resposta de uma pessoa a uma mensagem de prospecção (cold outreach) no WhatsApp, em português brasileiro.

Responda APENAS com uma destas palavras:
- interessado: demonstra interesse, faz pergunta sobre o produto/serviço, quer saber mais, aceita conversar
- nao_interessado: recusa educada ou seca ("não tenho interesse", "não obrigado")
- depois: pede pra falar em outro momento ("agora não posso", "me chama mês que vem")
- opt_out: pede pra parar de receber mensagens, remover da lista, ameaça denunciar
- neutro: pergunta quem é, resposta ambígua, cumprimento sem sinal claro

Nenhuma outra palavra. Sem pontuação.`;

export async function classifyReply(text: string): Promise<ReplyClass | null> {
  const t = (text ?? "").trim();
  if (!t) return null;
  try {
    const res = await chat({
      model: "fast",
      temperature: 0,
      maxTokens: 10,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: t.slice(0, 600) },
      ],
    });
    const out = (res.message.content ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "");
    return (REPLY_CLASSES as readonly string[]).includes(out) ? (out as ReplyClass) : null;
  } catch (err) {
    logger.warn({ err }, "classifyReply falhou (segue sem classe)");
    return null;
  }
}
