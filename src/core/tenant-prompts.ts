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

// ===== Versionamento =====
// Toda edição pelo painel guarda o estado ANTERIOR aqui (rede de segurança).

export type PromptVersionRow = {
  id: number;
  tenant_id: number;
  system: string;
  knowledge: string;
  objections: string;
  examples: string;
  author: string;
  created_at: Date;
};

export async function snapshotPrompts(tenantId: number, author: string): Promise<void> {
  const cur = await getTenantPrompts(tenantId);
  // Nada configurado ainda → nada a versionar.
  if (!cur.system && !cur.knowledge && !cur.objections && !cur.examples) return;
  await pool.query(
    `INSERT INTO tenant_prompt_versions (tenant_id, system, knowledge, objections, examples, author)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, cur.system, cur.knowledge, cur.objections, cur.examples, author],
  );
  // Mantém as 20 mais recentes.
  await pool.query(
    `DELETE FROM tenant_prompt_versions
      WHERE tenant_id = $1 AND id NOT IN (
        SELECT id FROM tenant_prompt_versions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20
      )`,
    [tenantId],
  );
}

export async function listPromptVersions(tenantId: number, limit = 20): Promise<
  Array<Pick<PromptVersionRow, "id" | "author" | "created_at"> & { chars: number }>
> {
  const { rows } = await pool.query<Pick<PromptVersionRow, "id" | "author" | "created_at"> & { chars: string }>(
    `SELECT id, author, created_at,
            (length(system) + length(knowledge) + length(objections) + length(examples))::text AS chars
       FROM tenant_prompt_versions
      WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows.map((r) => ({ ...r, chars: Number(r.chars) }));
}

export async function restorePromptVersion(
  tenantId: number,
  versionId: number,
  author: string,
): Promise<boolean> {
  const { rows } = await pool.query<PromptVersionRow>(
    `SELECT * FROM tenant_prompt_versions WHERE id = $1 AND tenant_id = $2`,
    [versionId, tenantId],
  );
  const v = rows[0];
  if (!v) return false;
  // O estado atual também vira versão — restaurar nunca perde nada.
  await snapshotPrompts(tenantId, `${author} (antes de restaurar)`);
  await upsertTenantPrompts(tenantId, {
    system: v.system,
    knowledge: v.knowledge,
    objections: v.objections,
    examples: v.examples,
  });
  return true;
}
