import { redis, keys } from "../core/redis.js";
import { config } from "../config.js";

type BufferedItem = {
  ts: number;
  text: string;
  messageId: string;
};

export async function appendBuffer(
  tenantSlug: string,
  waId: string,
  item: BufferedItem,
): Promise<void> {
  const k = keys.debounceBuffer(tenantSlug, waId);
  await redis.rpush(k, JSON.stringify(item));
  await redis.expire(k, Math.ceil(config.DEBOUNCE_MS / 1000) + 60);
}

export async function drainBuffer(tenantSlug: string, waId: string): Promise<string> {
  const k = keys.debounceBuffer(tenantSlug, waId);
  const items = await redis.lrange(k, 0, -1);
  await redis.del(k);
  if (!items.length) return "";
  const parsed = items
    .map((x) => {
      try {
        return JSON.parse(x) as BufferedItem;
      } catch {
        return null;
      }
    })
    .filter((x): x is BufferedItem => !!x)
    .sort((a, b) => a.ts - b.ts);
  return parsed.map((x) => x.text).join("\n").trim();
}
