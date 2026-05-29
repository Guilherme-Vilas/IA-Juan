import { pool } from "./db.js";
import { logger } from "./logger.js";

export type TenantRow = {
  id: number;
  slug: string;
  name: string;
  evolution_instance: string;
  owner_whatsapp_e164: string;
  owner_name: string;
  timezone: string;
  work_start_hour: number;
  work_end_hour: number;
  meeting_duration_min: number;
  prompt_dir: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

// Cache em memória pra evitar query a cada mensagem.
// TTL = 60s — qualquer mudança via UI futura espera no max 1min pra entrar em vigor.
const TTL_MS = 60 * 1000;
let cacheAt = 0;
let cacheBySlug = new Map<string, TenantRow>();
let cacheById = new Map<number, TenantRow>();
let cacheByInstance = new Map<string, TenantRow>();

async function refreshCache(): Promise<void> {
  const { rows } = await pool.query<TenantRow>(`SELECT * FROM tenants ORDER BY id ASC`);
  cacheBySlug = new Map(rows.map((t) => [t.slug, t]));
  cacheById = new Map(rows.map((t) => [t.id, t]));
  cacheByInstance = new Map(rows.map((t) => [t.evolution_instance, t]));
  cacheAt = Date.now();
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheAt > TTL_MS) await refreshCache();
}

export async function invalidateTenantsCache(): Promise<void> {
  cacheAt = 0;
}

export async function listTenants(): Promise<TenantRow[]> {
  await ensureCache();
  return [...cacheById.values()];
}

export async function getTenantBySlug(slug: string): Promise<TenantRow | null> {
  await ensureCache();
  return cacheBySlug.get(slug) ?? null;
}

export async function getTenantById(id: number): Promise<TenantRow | null> {
  await ensureCache();
  return cacheById.get(id) ?? null;
}

export async function getTenantByInstance(instance: string): Promise<TenantRow | null> {
  await ensureCache();
  return cacheByInstance.get(instance) ?? null;
}

export async function requireTenantBySlug(slug: string): Promise<TenantRow> {
  const t = await getTenantBySlug(slug);
  if (!t) {
    logger.error({ slug }, "tenant not found by slug");
    throw new Error(`tenant not found: ${slug}`);
  }
  return t;
}

export async function requireTenantById(id: number): Promise<TenantRow> {
  const t = await getTenantById(id);
  if (!t) throw new Error(`tenant not found: id=${id}`);
  return t;
}

// Fallback pra codigo que ainda nao recebe tenant — sempre Juan (id=1).
// Usar com moderacao; preferir passar tenant explicito.
export async function defaultTenant(): Promise<TenantRow> {
  return await requireTenantById(1);
}
