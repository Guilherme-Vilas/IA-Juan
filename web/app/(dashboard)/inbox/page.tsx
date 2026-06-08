import Link from "next/link";
import { AlertCircle, Flame, Pause, UserRoundCheck } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { Lead } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

type InboxLead = Lead & { last_message: string | null };

async function getInboxLeads(tenantId: number): Promise<InboxLead[]> {
  const { rows } = await pool.query<InboxLead>(
    `SELECT l.*,
            lm.content AS last_message
       FROM leads l
       LEFT JOIN LATERAL (
         SELECT content
           FROM messages m
          WHERE m.lead_id = l.id
          ORDER BY m.id DESC
          LIMIT 1
       ) lm ON true
      WHERE l.tenant_id = $1
        AND l.status = 'open'
        AND (
          l.state = 'HANDOFF'
          OR l.paused = true
          OR l.score >= 70
          OR (l.last_user_at IS NOT NULL AND (l.last_assistant_at IS NULL OR l.last_user_at > l.last_assistant_at))
        )
      ORDER BY
        CASE WHEN l.state = 'HANDOFF' THEN 0 WHEN l.paused THEN 1 WHEN l.score >= 70 THEN 2 ELSE 3 END,
        l.updated_at DESC
      LIMIT 100`,
    [tenantId],
  );
  return rows;
}

function reason(lead: InboxLead) {
  if (lead.state === "HANDOFF") return { icon: UserRoundCheck, label: "handoff", cls: "bg-orange-100 text-orange-700" };
  if (lead.paused) return { icon: Pause, label: "IA pausada", cls: "bg-warning/15 text-warning" };
  if (lead.score >= 70) return { icon: Flame, label: "lead quente", cls: "bg-success/15 text-success" };
  return { icon: AlertCircle, label: "aguardando resposta", cls: "bg-info/15 text-info" };
}

export default async function InboxPage() {
  const tenant = await getCurrentTenant();
  const leads = await getInboxLeads(tenant.id);

  return (
    <>
      <Header title="Inbox" subtitle={`${tenant.name} · ${leads.length} ações humanas`} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Prioridades</h2>
          </CardHeader>
          <CardBody className="divide-y divide-line">
            {leads.map((lead) => {
              const r = reason(lead);
              const Icon = r.icon;
              return (
                <Link key={lead.id} href="/leads" className="flex items-center gap-3 py-3 text-sm hover:bg-canvas-surface">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 font-semibold text-brand-400">
                    {(lead.nome ?? lead.slots.nome ?? lead.wa_id).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{lead.nome ?? lead.slots.nome ?? lead.wa_id}</div>
                    <div className="truncate text-xs text-ink-muted">{lead.last_message ?? lead.wa_id}</div>
                  </div>
                  <Badge className={r.cls}>
                    <Icon size={11} /> {r.label}
                  </Badge>
                  <Badge className="bg-canvas-surface-2 text-ink">
                    {lead.score_label} · {lead.score}
                  </Badge>
                  <span className="w-28 text-right text-xs text-ink-muted">
                    {formatRelative(lead.last_user_at ?? lead.updated_at)}
                  </span>
                </Link>
              );
            })}
            {leads.length === 0 && (
              <div className="grid h-40 place-items-center text-sm text-ink-muted">
                Nenhuma ação humana pendente.
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
