import { cookies } from "next/headers";
import { pool } from "./db";
import { TENANT_COOKIE, DEFAULT_SLUG, type TenantSummary } from "./tenant-client";

export { TENANT_COOKIE, DEFAULT_SLUG };
export type { TenantSummary };

export async function listTenantsForUI(): Promise<TenantSummary[]> {
  const { rows } = await pool.query<TenantSummary>(
    `SELECT id, slug, name, owner_name, active FROM tenants ORDER BY id ASC`,
  );
  return rows;
}

export function getCurrentTenantSlug(): string {
  return cookies().get(TENANT_COOKIE)?.value ?? DEFAULT_SLUG;
}

export async function getCurrentTenant(): Promise<TenantSummary> {
  const slug = getCurrentTenantSlug();
  const { rows } = await pool.query<TenantSummary>(
    `SELECT id, slug, name, owner_name, active FROM tenants WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (rows[0]) return rows[0];
  const def = await pool.query<TenantSummary>(
    `SELECT id, slug, name, owner_name, active FROM tenants WHERE slug = $1 LIMIT 1`,
    [DEFAULT_SLUG],
  );
  if (def.rows[0]) return def.rows[0];
  const first = await pool.query<TenantSummary>(
    `SELECT id, slug, name, owner_name, active FROM tenants ORDER BY id ASC LIMIT 1`,
  );
  if (!first.rows[0]) throw new Error("no tenants in DB (run migration 005)");
  return first.rows[0];
}
