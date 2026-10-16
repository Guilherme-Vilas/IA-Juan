import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { getCurrentTenant } from "@/lib/tenant";
import { HealthBoard } from "./_components/health-board";

export const dynamic = "force-dynamic";

// Saúde da plataforma (superadmin): descubra o problema antes do cliente ligar.
export default async function HealthPage() {
  const session = await getSession();
  if (!session?.is_superadmin) redirect("/leads");
  const tenant = await getCurrentTenant();

  return (
    <>
      <Header title="Saúde" subtitle="chips, filas e consumo de IA — atualiza a cada 30s" />
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <HealthBoard tenantSlug={tenant.slug} />
      </div>
    </>
  );
}
