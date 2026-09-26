import { getSession } from "@/lib/session";

// Escopo de visão por papel: SDR só enxerga os leads DELE (mais os ainda sem
// responsável, pra ninguém ficar órfão). Owner/admin/viewer/superadmin veem tudo.
// Aplicado direto no SQL das telas que listam leads — não é só filtro de UI.

export type LeadScope = { sdrOnly: boolean; userId: number | null };

export async function getLeadScope(tenantId: number): Promise<LeadScope> {
  const session = await getSession();
  if (!session || session.kind === "service" || session.is_superadmin) {
    return { sdrOnly: false, userId: session?.userId ?? null };
  }
  const role = session.tenants.find((t) => t.tenant_id === tenantId)?.role;
  return { sdrOnly: role === "sdr", userId: session.userId ?? null };
}

// Fragmento SQL do escopo. Os params já devem conter o tenantId; o userId entra
// como o próximo placeholder ($n).
export function scopeSql(scope: LeadScope, alias: string, paramIndex: number): { sql: string; params: number[] } {
  if (!scope.sdrOnly || scope.userId == null) return { sql: "", params: [] };
  return {
    sql: ` AND (${alias}.assigned_user_id = $${paramIndex} OR ${alias}.assigned_user_id IS NULL)`,
    params: [scope.userId],
  };
}
