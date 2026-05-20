import IORedis from "ioredis";
import { config } from "../config.js";

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const bullConnection = { connection: redis };

export const keys = {
  leadState: (waId: string) => `lead:${waId}:state`,
  leadSlots: (waId: string) => `lead:${waId}:slots`,
  leadHistory: (waId: string) => `lead:${waId}:history`,
  leadPaused: (waId: string) => `lead:${waId}:paused`,
  debounceBuffer: (waId: string) => `lead:${waId}:debounce`,
};
