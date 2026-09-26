import { redis } from "./redis.js";
import { logger } from "./logger.js";
import { config } from "../config.js";

// Orçamento diário de tokens de LLM por tenant. Antes o consumo era só logado —
// um lead (ou spammer) conversando sem parar gerava custo ilimitado.
// Contador em Redis por dia; estourou → a IA silencia até virar o dia e o dono
// é avisado uma única vez. LLM_DAILY_TOKENS_PER_TENANT=0 desliga o limite.

const dayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const USAGE_KEY = (slug: string) => `llm:usage:${slug}:${dayKey()}`;
const NOTIFIED_KEY = (slug: string) => `llm:capnotified:${slug}:${dayKey()}`;

export async function recordLlmUsage(tenantSlug: string, tokens: number): Promise<void> {
  if (!tokens || tokens <= 0) return;
  try {
    const k = USAGE_KEY(tenantSlug);
    const total = await redis.incrby(k, tokens);
    if (total === tokens) await redis.expire(k, 2 * 24 * 3600);
  } catch {
    /* contagem é best-effort */
  }
}

export async function getLlmUsageToday(tenantSlug: string): Promise<number> {
  try {
    return Number((await redis.get(USAGE_KEY(tenantSlug))) ?? 0);
  } catch {
    return 0;
  }
}

// true = estourou o orçamento do dia (e ainda não deve gastar mais).
export async function isLlmBudgetExceeded(tenantSlug: string): Promise<boolean> {
  const cap = config.LLM_DAILY_TOKENS_PER_TENANT;
  if (!cap) return false;
  const used = await getLlmUsageToday(tenantSlug);
  return used >= cap;
}

// Aviso único por dia quando estoura (o chamador decide o canal).
export async function shouldNotifyBudgetExceeded(tenantSlug: string): Promise<boolean> {
  try {
    const first = await redis.set(NOTIFIED_KEY(tenantSlug), "1", "EX", 24 * 3600, "NX");
    if (first === "OK") {
      logger.warn({ tenant: tenantSlug, cap: config.LLM_DAILY_TOKENS_PER_TENANT }, "llm: orçamento diário estourado");
      return true;
    }
  } catch {
    /* sem Redis não notifica */
  }
  return false;
}
