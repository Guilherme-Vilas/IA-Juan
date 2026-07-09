import { cookies } from "next/headers";
import { pool } from "./db";
import { getSession } from "./session";
import { TENANT_COOKIE, DEFAULT_SLUG, type TenantSummary } from "./tenant-client";

export { TENANT_COOKIE, DEFAULT_SLUG };
export type { TenantSummary };

// Lista APENAS os tenants que o usuário logado pode acessar (per-tenant scoping).
// Superadmin/service: todos. Usuário comum: só os vinculados (user_tenants).
export async function listTenantsForUI(): Promise<TenantSummary[]> {
  const session = await getSession();
  if (!session) return [];
  const allowedSlugs = new Set(session.tenants.map((t) => t.slug));
  const { rows } = await pool.query<TenantSummary>(
    `SELECT id, slug, name, owner_name, active, training_enabled FROM tenants ORDER BY id ASC`,
  );
  // Superadmin enxerga tudo; demais, só os permitidos.
  if (session.is_superadmin) return rows;
  return rows.filter((t) => allowedSlugs.has(t.slug));
}

export function getCurrentTenantSlug(): string {
  return cookies().get(TENANT_COOKIE)?.value ?? DEFAULT_SLUG;
}

// Retorna o tenant selecionado — SEMPRE dentro do conjunto permitido pro usuário.
// Se o cookie apontar pra um tenant que o user não acessa, cai no primeiro permitido.
export async function getCurrentTenant(): Promise<TenantSummary> {
  const allowed = await listTenantsForUI();
  if (allowed.length === 0) throw new Error("usuário sem tenants acessíveis");
  const slug = getCurrentTenantSlug();
  return allowed.find((t) => t.slug === slug) ?? allowed[0]!;
}
