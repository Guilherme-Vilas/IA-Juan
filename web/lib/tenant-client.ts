// Constantes/tipos compartilhados entre server e client.
// O helper em ./tenant.ts importa `next/headers` (server-only).

export const TENANT_COOKIE = "selected_tenant_slug";
export const DEFAULT_SLUG = "juan";

export type TenantSummary = {
  id: number;
  slug: string;
  name: string;
  owner_name: string;
  active: boolean;
  training_enabled: boolean;
};
