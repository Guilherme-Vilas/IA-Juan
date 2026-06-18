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

// Secret obrigatorio e forte: min 32 chars e proibe placeholders comuns.
// Falha no boot se o ambiente estiver inseguro (em vez de degradar silenciosamente).
const WEAK_VALUES = ["change-me", "changeme", "secret", "password", "todo", "xxx"];
function strongSecret(name: string) {
  return z
    .string({ required_error: `${name} é obrigatório` })
    .min(32, `${name} deve ter no mínimo 32 caracteres`)
    .refine(
      (v) => !WEAK_VALUES.some((w) => v.toLowerCase().includes(w)),
      `${name} contém um valor fraco/placeholder — gere um segredo forte (openssl rand -hex 24)`,
    );
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url(),
  // URL publica do painel/dashboard (Next.js). Usada pra montar o link de convite.
  APP_PUBLIC_URL: z.string().url().default("https://systemvita.com.br"),
  // Validade do link de convite, em dias.
  INVITE_TTL_DAYS: z.coerce.number().default(2),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_MAIN: z.string().default("gpt-4o-mini"),
  OPENAI_MODEL_FAST: z.string().default("gpt-4o-mini"),
  OPENAI_MODEL_AUDIO: z.string().default("whisper-1"),
  OPENAI_MODEL_EMBED: z.string().default("text-embedding-3-small"),

  // Evolution API: base URL + key sao compartilhados; a instancia (whatsapp connection)
  // vem por tenant na tabela tenants.evolution_instance.
  EVOLUTION_BASE_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  // Secret de webhook NAO pode ser fraco — protege o endpoint que injeta mensagens.
  EVOLUTION_WEBHOOK_TOKEN: strongSecret("EVOLUTION_WEBHOOK_TOKEN"),
  // URL interna (rede do compose) que o Evolution usa pra alcancar o app no
  // provisionamento automatico de instancias. Default = service name do compose.
  EVOLUTION_INTERNAL_WEBHOOK_URL: z
    .string()
    .url()
    .default("http://app:3000/webhook/evolution"),

  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  // Limite explicito de conexoes do pool Postgres por processo (evita esgotar o banco).
  PG_POOL_MAX: z.coerce.number().default(10),

  // Auth: segredo de assinatura do JWT. Obrigatorio e forte.
  JWT_SECRET: strongSecret("JWT_SECRET"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  // Token de servico (backend->backend, ex: SSR do dashboard). Concede superadmin.
  // Continua existindo para integracoes internas, mas NAO e mais usado como auth de tenant.
  ADMIN_API_TOKEN: strongSecret("ADMIN_API_TOKEN"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  // Secret que assina o `state` do OAuth (anti-CSRF). Sem default vazio.
  GOOGLE_OAUTH_STATE_SECRET: strongSecret("GOOGLE_OAUTH_STATE_SECRET"),
  GOOGLE_CALENDAR_ID: z.string().default("primary"),

  DEBOUNCE_MS: z.coerce.number().default(5000),
  LEAD_STATE_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),

  FOLLOWUP_1_MS: z.coerce.number().default(40 * 60 * 1000), // 40min — lead respira antes do primeiro toque
  FOLLOWUP_2_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
  FOLLOWUP_CLOSE_MS: z.coerce.number().default(24 * 60 * 60 * 1000),

  SIMULATOR_MODE: booleanFromEnv.default(false),

  // Prospect module
  PROSPECT_TICK_MS: z.coerce.number().default(5 * 60 * 1000),
  PROSPECT_JITTER_MS: z.coerce.number().default(10 * 60 * 1000),
  PROSPECT_DEFAULT_RATE_PER_DAY: z.coerce.number().default(30),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
