import { pool } from "@/lib/db";
import type { Lead, PipelineStage } from "@/lib/types";
import { Header } from "@/components/layout/header";
import { LeadsBoard } from "./_components/leads-board";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function getLeads(tenantId: number): Promise<Lead[]> {
  const { rows } = await pool.query<Lead>(
    `SELECT * FROM leads
       WHERE tenant_id = $1
         AND (status = 'open' OR updated_at > now() - interval '30 days')
       ORDER BY updated_at DESC
       LIMIT 500`,
    [tenantId],
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

export default async function LeadsPage() {
  const tenant = await getCurrentTenant();
  const [leads, stages] = await Promise.all([getLeads(tenant.id), getStages(tenant.id)]);
  const openCount = leads.filter((l) => l.status === "open").length;
  return (
    <>
      <Header
        title="Pipeline"
        subtitle={`${tenant.name} · ${openCount} abertos · ${leads.length - openCount} fechados (últimos 30d)`}
      />
      <div className="flex-1 overflow-hidden bg-canvas">
        <LeadsBoard initial={leads} initialStages={stages} />
      </div>
    </>
  );
}
