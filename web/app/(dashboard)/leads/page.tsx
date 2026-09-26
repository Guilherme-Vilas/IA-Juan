import { pool } from "@/lib/db";
import { getLeadScope, scopeSql } from "@/lib/lead-scope";
import type { Lead, PipelineStage, TenantMember, CustomFieldDef } from "@/lib/types";
import { Header } from "@/components/layout/header";
import { LeadsBoard } from "./_components/leads-board";
import { OnboardingChecklist, type OnboardingStatus } from "./_components/onboarding-checklist";
import { adminCall } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function getMembers(tenantId: number): Promise<TenantMember[]> {
  const { rows } = await pool.query<TenantMember>(
    `SELECT ut.user_id, u.name, u.email, ut.role
       FROM user_tenants ut JOIN users u ON u.id = ut.user_id
      WHERE ut.tenant_id = $1 AND u.active = true
      ORDER BY u.name ASC, u.id ASC`,
    [tenantId],
  );
  return rows;
}

async function getDistribution(tenantId: number): Promise<"manual" | "round_robin"> {
  const { rows } = await pool.query<{ lead_distribution: "manual" | "round_robin" }>(
    `SELECT lead_distribution FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return rows[0]?.lead_distribution ?? "manual";
}

async function getFieldDefs(tenantId: number): Promise<CustomFieldDef[]> {
  const { rows } = await pool.query<CustomFieldDef>(
    `SELECT id, key, label, type, options, position FROM custom_field_defs
      WHERE tenant_id = $1 ORDER BY position ASC, id ASC`,
    [tenantId],
  );
  return rows;
}

async function getLeads(tenantId: number): Promise<Lead[]> {
  const scope = await getLeadScope(tenantId);
  const sc = scopeSql(scope, "leads", 2);
  const { rows } = await pool.query<Lead>(
    `SELECT * FROM leads
       WHERE tenant_id = $1
         AND (status = 'open' OR updated_at > now() - interval '30 days')${sc.sql}
       ORDER BY updated_at DESC
       LIMIT 500`,
    [tenantId, ...sc.params],
  );
  return rows;
}

async function getStages(tenantId: number): Promise<PipelineStage[]> {
  const { rows } = await pool.query<PipelineStage>(
    `SELECT ps.* FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.tenant_id = $1
      ORDER BY ps.position ASC, ps.id ASC`,
    [tenantId],
  );
  return rows;
}

export default async function LeadsPage({ searchParams }: { searchParams?: { lead?: string } }) {
  const tenant = await getCurrentTenant();
  const [leads, stages, members, distribution, fieldDefs] = await Promise.all([
    getLeads(tenant.id),
    getStages(tenant.id),
    getMembers(tenant.id),
    getDistribution(tenant.id),
    getFieldDefs(tenant.id),
  ]);
  const openCount = leads.filter((l) => l.status === "open").length;

  // Primeiro uso: sem nenhum lead, mostra o checklist de ativação no topo.
  let onboarding: OnboardingStatus | null = null;
  if (leads.length === 0) {
    const [wa, agent, campaigns] = await Promise.all([
      adminCall(`/admin/tenants/${tenant.slug}/whatsapp/status`, { method: "GET" }).catch(() => null) as Promise<{
        connected?: boolean;
      } | null>,
      pool.query(`SELECT 1 FROM tenant_agent_settings WHERE tenant_id = $1`, [tenant.id]).catch(() => null),
      pool.query(`SELECT 1 FROM campaigns WHERE tenant_id = $1 LIMIT 1`, [tenant.id]).catch(() => null),
    ]);
    onboarding = {
      whatsappConnected: !!wa?.connected,
      agentConfigured: (agent?.rowCount ?? 0) > 0,
      hasCampaign: (campaigns?.rowCount ?? 0) > 0,
    };
  }
  return (
    <>
      <Header
        title="Pipeline"
        subtitle={`${tenant.name} · ${openCount} abertos · ${leads.length - openCount} fechados (últimos 30d)`}
      />
      <div className="flex-1 overflow-hidden">
        {onboarding && <OnboardingChecklist status={onboarding} />}
        <LeadsBoard
          initialOpenWaId={searchParams?.lead ?? null}
          initial={leads}
          initialStages={stages}
          members={members}
          distribution={distribution}
          fieldDefs={fieldDefs}
        />
      </div>
    </>
  );
}
