import { Header } from "@/components/layout/header";
import { getCurrentTenant } from "@/lib/tenant";
import { DiscoveryHub } from "./_components/discovery-hub";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const tenant = await getCurrentTenant();
  return (
    <>
      <Header
        title="Buscar leads"
        subtitle="Gere listas prontas a partir de dados públicos de CNPJ — filtre pelo seu cliente ideal, valide WhatsApp e crie a campanha em 1 clique"
      />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <DiscoveryHub tenantSlug={tenant.slug} />
      </div>
    </>
  );
}
