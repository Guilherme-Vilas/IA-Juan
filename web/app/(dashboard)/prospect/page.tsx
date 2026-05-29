import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { campaignApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  type Campaign,
} from "@/lib/types";
import { Plus, Send } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProspectListPage() {
  const tenant = await getCurrentTenant();
  let campaigns: Campaign[] = [];
  let error: string | null = null;
  try {
    const data = (await campaignApi(tenant.slug).list()) as { campaigns: Campaign[] };
    campaigns = data.campaigns;
  } catch (err) {
    error = String(err);
  }

  return (
    <>
      <Header
        title="Prospecção"
        subtitle={`${tenant.name} · ${campaigns.length} campanha(s)`}
        action={
          <Link
            href="/prospect/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={14} /> Nova campanha
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <Card>
            <CardBody className="text-sm text-danger">Erro ao carregar: {error}</CardBody>
          </Card>
        )}
        {!error && campaigns.length === 0 && (
          <div className="grid h-64 place-items-center text-sm text-ink-muted">
            <div className="text-center">
              <Send size={32} className="mx-auto mb-2 text-ink-muted/50" />
              <p>Nenhuma campanha ainda.</p>
              <p className="mt-1 text-xs">Crie uma pra começar a prospectar.</p>
            </div>
          </div>
        )}
        {campaigns.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/prospect/${c.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardBody>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{c.name}</h3>
                      <Badge className={`${CAMPAIGN_STATUS_COLORS[c.status]} text-white`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                      <Badge className="bg-slate-100 text-slate-700 capitalize">{c.channel}</Badge>
                      <span>·</span>
                      <span>{c.rate_per_day}/dia</span>
                      {c.ai_refine && (
                        <>
                          <span>·</span>
                          <span>IA refine</span>
                        </>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-ink-muted">{c.template_text}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
