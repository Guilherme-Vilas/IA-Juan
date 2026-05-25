import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return v;
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url(),

  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL_MAIN: z.string().default("llama-3.3-70b-versatile"),
  GROQ_MODEL_FAST: z.string().default("llama-3.1-8b-instant"),
  GROQ_MODEL_AUDIO: z.string().default("whisper-large-v3"),

  EVOLUTION_BASE_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE: z.string().min(1),
  EVOLUTION_WEBHOOK_TOKEN: z.string().min(1),

  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_ID: z.string().default("primary"),
  GOOGLE_TOKENS_PATH: z.string().default("./.tokens/google.json"),

  JUAN_NAME: z.string().default("Juan"),
  JUAN_WHATSAPP_E164: z.string().min(10),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
  WORK_START_HOUR: z.coerce.number().default(9),
  WORK_END_HOUR: z.coerce.number().default(19),
  MEETING_DURATION_MIN: z.coerce.number().default(15),

  DEBOUNCE_MS: z.coerce.number().default(5000),
  LEAD_STATE_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),

  FOLLOWUP_1_MS: z.coerce.number().default(15 * 60 * 1000),
  FOLLOWUP_2_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
  FOLLOWUP_CLOSE_MS: z.coerce.number().default(24 * 60 * 60 * 1000),

  SIMULATOR_MODE: booleanFromEnv.default(false),

  // Prospect module
  PROSPECT_TICK_MS: z.coerce.number().default(5 * 60 * 1000), // 5min
  PROSPECT_JITTER_MS: z.coerce.number().default(10 * 60 * 1000), // ±10min
  PROSPECT_DEFAULT_RATE_PER_DAY: z.coerce.number().default(30),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
