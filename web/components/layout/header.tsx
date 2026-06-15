import { listTenantsForUI, getCurrentTenantSlug } from "@/lib/tenant";
import { TenantSelector } from "./tenant-selector";

// Header — vidro (macOS) com blur, marca/título serifado.
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
    /* migration ainda não rodou — segue sem selector */
  }

  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line px-8">
      <div>
        <h1 className="font-serif text-xl text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {tenants.length > 0 && <TenantSelector tenants={tenants} currentSlug={currentSlug} />}
      </div>
    </header>
  );
}
