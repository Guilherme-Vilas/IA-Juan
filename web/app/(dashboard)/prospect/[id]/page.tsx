import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { campaignApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import type { Campaign, CampaignFunnel, CampaignMetrics, CampaignStep, Prospect } from "@/lib/types";
import { CampaignDetail } from "./_components/campaign-detail";

export const dynamic = "force-dynamic";

type DetailResponse = {
  campaign: Campaign;
  metrics: CampaignMetrics;
  prospects: Prospect[];
  steps?: CampaignStep[];
  funnel?: CampaignFunnel;
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const tenant = await getCurrentTenant();
  let data: DetailResponse;
  try {
    data = (await campaignApi(tenant.slug).get(id)) as DetailResponse;
  } catch {
    notFound();
  }
  return (
    <>
      <Header
        title={data!.campaign.name}
        subtitle={`${tenant.name} · Canal: ${data!.campaign.channel} · ${data!.campaign.rate_per_day}/dia`}
      />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <CampaignDetail
          tenantSlug={tenant.slug}
          campaign={data!.campaign}
          metrics={data!.metrics}
          prospects={data!.prospects}
          steps={data!.steps ?? []}
          funnel={data!.funnel ?? null}
        />
      </div>
    </>
  );
}
