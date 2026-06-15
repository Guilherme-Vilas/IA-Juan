import { pool } from "./db.js";
import { redis } from "./redis.js";
import { logger } from "./logger.js";

export type TenantPromptsRow = {
  tenant_id: number;
  system: string;
  knowledge: string;
  objections: string;
  examples: string;
  updated_at: Date;
};

export type TenantPrompts = {
  system: string;
  knowledge: string;
  objections: string;
  examples: string;
};

const CACHE_KEY = (tenantId: number) => `prompts:${tenantId}`;
const CACHE_TTL_S = 300; // 5min — edicao via painel reflete em no max 5min (ou invalida no save)

export async function getTenantPrompts(tenantId: number): Promise<TenantPrompts> {
  // 1) Redis cache
  try {
    const cached = await redis.get(CACHE_KEY(tenantId));
    if (cached) return JSON.parse(cached) as TenantPrompts;
  } catch (err) {
    logger.warn({ err, tenantId }, "prompts cache read failed");
  }

  // 2) Postgres
  const { rows } = await pool.query<TenantPromptsRow>(
    `SELECT * FROM tenant_prompts WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = rows[0];
  const prompts: TenantPrompts = {
    system: row?.system ?? "",
    knowledge: row?.knowledge ?? "",
    objections: row?.objections ?? "",
    examples: row?.examples ?? "",
  };

  // 3) Popula cache
  try {
    await redis.set(CACHE_KEY(tenantId), JSON.stringify(prompts), "EX", CACHE_TTL_S);
  } catch {
    /* cache best-effort */
  }
  return prompts;
}

export async function upsertTenantPrompts(
  tenantId: number,
  patch: Partial<TenantPrompts>,
): Promise<void> {
  await pool.query(
    `INSERT INTO tenant_prompts (tenant_id, system, knowledge, objections, examples)
     VALUES ($1, COALESCE($2,''), COALESCE($3,''), COALESCE($4,''), COALESCE($5,''))
     ON CONFLICT (tenant_id) DO UPDATE SET
       system = COALESCE($2, tenant_prompts.system),
       knowledge = COALESCE($3, tenant_prompts.knowledge),
       objections = COALESCE($4, tenant_prompts.objections),
       examples = COALESCE($5, tenant_prompts.examples),
       updated_at = now()`,
    [tenantId, patch.system ?? null, patch.knowledge ?? null, patch.objections ?? null, patch.examples ?? null],
  );
  await invalidatePromptsCache(tenantId);
}

export async function invalidatePromptsCache(tenantId: number): Promise<void> {
  try {
    await redis.del(CACHE_KEY(tenantId));
  } catch {
    /* ignore */
  }
}
