import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { campaignApi } from "@/lib/api";
import type { Campaign, CampaignMetrics, Prospect } from "@/lib/types";
import { CampaignDetail } from "./_components/campaign-detail";

export const dynamic = "force-dynamic";

type DetailResponse = {
  campaign: Campaign;
  metrics: CampaignMetrics;
  prospects: Prospect[];
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  let data: DetailResponse;
  try {
    data = (await campaignApi.get(id)) as DetailResponse;
  } catch {
    notFound();
  }
  return (
    <>
      <Header
        title={data!.campaign.name}
        subtitle={`Canal: ${data!.campaign.channel} · ${data!.campaign.rate_per_day}/dia`}
      />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <CampaignDetail
          campaign={data!.campaign}
          metrics={data!.metrics}
          prospects={data!.prospects}
        />
      </div>
    </>
  );
}
