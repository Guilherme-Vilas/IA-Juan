import IORedis from "ioredis";
import { config } from "../config.js";

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const bullConnection = { connection: redis };

// Todas as chaves de lead sao prefixadas por tenant slug pra isolar tenants no mesmo Redis.
// Ex: lead:juan:5511999998888:state, lead:facilita:5511999998888:state.
export const keys = {
  leadState: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:state`,
  leadSlots: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:slots`,
  leadHistory: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:history`,
  leadPaused: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:paused`,
  debounceBuffer: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:debounce`,
  offeredSlots: (tenantSlug: string, waId: string) => `lead:${tenantSlug}:${waId}:offered_slots`,
};
