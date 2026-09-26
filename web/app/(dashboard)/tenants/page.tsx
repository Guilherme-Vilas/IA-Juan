import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Header } from "@/components/layout/header";
import { tenantsApi } from "@/lib/api";
import { TenantsHub } from "./_components/tenants-hub";

export const dynamic = "force-dynamic";

type TenantSummary = {
  id: number;
  slug: string;
  name: string;
  evolution_instance: string;
  owner_name: string;
  playbook_slug: string | null;
  active: boolean;
  training_enabled: boolean;
};

export default async function TenantsPage() {
  // Defesa server-side: página de plataforma é só de superadmin (o menu já
  // esconde, mas URL digitada na mão não pode abrir).
  const session = await getSession();
  if (!session?.is_superadmin) redirect("/leads");

  let tenants: TenantSummary[] = [];
  let error: string | null = null;
  try {
    const data = (await tenantsApi.list()) as { tenants: TenantSummary[] };
    tenants = data.tenants;
  } catch (err) {
    error = String(err);
  }

  return (
    <>
      <Header
        title="Instâncias"
        subtitle="Provisionamento e gestão dos clientes (tenants)"
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <TenantsHub initial={tenants} error={error} />
      </div>
    </>
  );
}
