import { redis } from "./redis.js";
import { logger } from "./logger.js";

// Rate limit de janela fixa em Redis (INCR + EXPIRE), mesmo padrão já usado no
// reset de senha. Fail-open: se o Redis falhar, deixa passar — indisponibilidade
// de Redis não pode derrubar login/captura (as rotas já dependem dele pra mais coisas).
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const k = `rl:${key}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSeconds);
    return { allowed: n <= limit, remaining: Math.max(0, limit - n) };
  } catch (err) {
    logger.warn({ err, key }, "rate-limit: redis indisponível (fail-open)");
    return { allowed: true, remaining: limit };
  }
}
