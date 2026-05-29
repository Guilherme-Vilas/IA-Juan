import { listTenantsForUI, getCurrentTenantSlug } from "@/lib/tenant";
import { TenantSelector } from "./tenant-selector";

// Header e server component — busca tenants do DB e passa pro selector (client).
export async function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  let tenants: Awaited<ReturnType<typeof listTenantsForUI>> = [];
  let currentSlug = "juan";
  try {
    tenants = await listTenantsForUI();
    currentSlug = getCurrentTenantSlug();
  } catch {
    // se a migration 005 ainda nao rodou, segue sem selector
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {tenants.length > 0 && (
          <TenantSelector tenants={tenants} currentSlug={currentSlug} />
        )}
      </div>
    </header>
  );
}
