import crypto from "node:crypto";
import { redis } from "./redis.js";

// Distingue, no webhook, uma mensagem fromMe que o PRÓPRIO sistema mandou (eco
// da Evolution) de uma que o dono digitou no celular. Toda saída registra o hash
// do texto aqui; o webhook confere. Sem match = humano no aparelho → takeover.

const KEY = (tenantSlug: string, waId: string) => `echo:${tenantSlug}:${waId}`;
const TTL_S = 300;

const hash = (text: string) =>
  crypto.createHash("sha1").update(text.replace(/\s+/g, " ").trim()).digest("hex");

export async function markEchoSent(tenantSlug: string, waId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  try {
    const k = KEY(tenantSlug, waId);
    await redis.rpush(k, hash(text));
    await redis.ltrim(k, -20, -1);
    await redis.expire(k, TTL_S);
  } catch {
    /* best-effort: sem Redis, o takeover só fica mais conservador */
  }
}

// Confere e CONSOME o eco (um envio = um eco).
export async function consumeEcho(tenantSlug: string, waId: string, text: string): Promise<boolean> {
  try {
    const k = KEY(tenantSlug, waId);
    const removed = await redis.lrem(k, 1, hash(text));
    return removed > 0;
  } catch {
    // Redis fora: assume eco (NÃO pausa a IA por engano).
    return true;
  }
}
