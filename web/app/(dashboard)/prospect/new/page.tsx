import { Header } from "@/components/layout/header";
import { NewCampaignForm } from "./_components/new-campaign-form";
import { getCurrentTenant } from "@/lib/tenant";

export default async function NewCampaignPage() {
  const tenant = await getCurrentTenant();
  return (
    <>
      <Header title="Nova campanha" subtitle={`${tenant.name} · Configure canal, mensagem e cadência`} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <NewCampaignForm tenantSlug={tenant.slug} />
      </div>
    </>
  );
}
