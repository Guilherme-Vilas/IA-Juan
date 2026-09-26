import { listTenantsForUI, getCurrentTenantSlug } from "@/lib/tenant";
import { TenantSelector } from "./tenant-selector";

// Header — vidro (macOS) com blur, hairline bronze na base, título serifado.
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
    <header className="glass hairline-b sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-8">
      <div className="min-w-0 animate-fade-up">
        <h1 className="truncate font-serif text-lg tracking-tight text-ink md:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 hidden truncate text-xs text-ink-muted sm:block">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {action}
        {tenants.length > 0 && <TenantSelector tenants={tenants} currentSlug={currentSlug} />}
      </div>
    </header>
  );
}
