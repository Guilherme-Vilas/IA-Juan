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
  playbook_slug: string | null;
  active: boolean;
  // CRM: distribuicao de leads novos (manual | round_robin) + ponteiro do rodizio.
  lead_distribution: "manual" | "round_robin";
  last_assigned_user_id: number | null;
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

export type CreateTenantInput = {
  slug: string;
  name: string;
  evolution_instance: string;
  owner_whatsapp_e164: string;
  owner_name?: string;
  timezone?: string;
  work_start_hour?: number;
  work_end_hour?: number;
  meeting_duration_min?: number;
  prompt_dir?: string;
  playbook_slug?: string | null;
  active?: boolean;
};

export async function createTenant(input: CreateTenantInput): Promise<TenantRow> {
  const { rows } = await pool.query<TenantRow>(
    `INSERT INTO tenants
       (slug, name, evolution_instance, owner_whatsapp_e164, owner_name, timezone,
        work_start_hour, work_end_hour, meeting_duration_min, prompt_dir, playbook_slug, active)
     VALUES ($1,$2,$3,$4,COALESCE($5,''),COALESCE($6,'America/Sao_Paulo'),
             COALESCE($7,9),COALESCE($8,18),COALESCE($9,60),COALESCE($10,$1),$11,COALESCE($12,false))
     RETURNING *`,
    [
      input.slug,
      input.name,
      input.evolution_instance,
      input.owner_whatsapp_e164,
      input.owner_name ?? null,
      input.timezone ?? null,
      input.work_start_hour ?? null,
      input.work_end_hour ?? null,
      input.meeting_duration_min ?? null,
      input.prompt_dir ?? null,
      input.playbook_slug ?? null,
      input.active ?? null,
    ],
  );
  await invalidateTenantsCache();
  return rows[0]!;
}

export async function setTenantActive(tenantId: number, active: boolean): Promise<void> {
  await pool.query(`UPDATE tenants SET active = $1, updated_at = now() WHERE id = $2`, [active, tenantId]);
  await invalidateTenantsCache();
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
