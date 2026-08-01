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
import { Plus, Send, MessageCircle, Reply } from "lucide-react";
import { BlacklistButton } from "./_components/blacklist-manager";

export const dynamic = "force-dynamic";

type CampaignWithStats = Campaign & {
  stats?: { prospects: number; sends: number; replies: number };
};

function pct(part: number, whole: number): string | null {
  if (!whole) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function ProspectListPage() {
  const tenant = await getCurrentTenant();
  let campaigns: CampaignWithStats[] = [];
  let error: string | null = null;
  try {
    const data = (await campaignApi(tenant.slug).list()) as { campaigns: CampaignWithStats[] };
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
          <div className="flex items-center gap-2">
            <BlacklistButton tenantSlug={tenant.slug} />
            <Link
              href="/prospect/new"
              className="shine inline-flex h-9 items-center gap-2 rounded-md bg-bronze-metal px-4 text-sm font-semibold text-ink-inverse transition-shadow hover:shadow-glow-bronze"
            >
              <Plus size={14} /> Nova campanha
            </Link>
          </div>
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
              <Send size={32} className="mx-auto mb-2 text-accent-bronze/50" />
              <p className="font-serif text-lg text-ink">Nenhuma campanha ainda.</p>
              <p className="mt-1 text-xs">Crie uma, ou gere a lista em Buscar leads.</p>
            </div>
          </div>
        )}
        {campaigns.length > 0 && (
          <div className="stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const s = c.stats ?? { prospects: 0, sends: 0, replies: 0 };
              const rate = pct(s.replies, s.sends);
              return (
                <Link key={c.id} href={`/prospect/${c.id}`}>
                  <Card hoverable className="h-full cursor-pointer">
                    <CardBody>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-[15px] text-ink">{c.name}</h3>
                        <Badge className={`${CAMPAIGN_STATUS_COLORS[c.status]} text-white`}>
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-muted">
                        <span className="capitalize">{c.channel}</span>
                        <span>·</span>
                        <span>{c.rate_per_day}/dia</span>
                        <span>·</span>
                        <span>{s.prospects} na lista</span>
                      </div>

                      {/* Os números que importam, na cara */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-canvas-deep/60 p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-ink-muted">
                            <MessageCircle size={9} /> Enviadas
                          </div>
                          <div className="font-serif text-lg text-ink">{s.sends}</div>
                        </div>
                        <div className="rounded-lg bg-canvas-deep/60 p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-ink-muted">
                            <Reply size={9} /> Respostas
                          </div>
                          <div className="font-serif text-lg text-ink">{s.replies}</div>
                        </div>
                        <div
                          className={`rounded-lg p-2 text-center ${
                            rate ? "border border-accent-bronze/30 bg-accent-bronze/10" : "bg-canvas-deep/60"
                          }`}
                        >
                          <div className="text-[9px] uppercase tracking-wide text-ink-muted">Taxa</div>
                          <div className={`font-serif text-lg ${rate ? "text-accent-bronze-soft" : "text-ink-faint"}`}>
                            {rate ?? "—"}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
