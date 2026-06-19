import { Header } from "@/components/layout/header";
import { getCurrentTenant } from "@/lib/tenant";
import { pool } from "@/lib/db";
import { automationsApi } from "@/lib/api";
import type { Automation, PipelineStage } from "@/lib/types";
import { AutomationsManager } from "./_components/automations-manager";

export const dynamic = "force-dynamic";

async function getStages(tenantId: number): Promise<PipelineStage[]> {
  const { rows } = await pool.query<PipelineStage>(
    `SELECT ps.* FROM pipeline_stages ps JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.tenant_id = $1 ORDER BY ps.position ASC, ps.id ASC`,
    [tenantId],
  );
  return rows;
}

export default async function AutomationsPage() {
  const tenant = await getCurrentTenant();
  let automations: Automation[] = [];
  let error: string | null = null;
  try {
    automations = ((await automationsApi(tenant.slug).list()) as { automations: Automation[] }).automations;
  } catch (err) {
    error = String(err);
  }
  const stages = await getStages(tenant.id);

  return (
    <>
      <Header title="Automações" subtitle={`${tenant.name} · regras e cadências que rodam sozinhas`} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AutomationsManager initial={automations} stages={stages} error={error} />
      </div>
    </>
  );
}
