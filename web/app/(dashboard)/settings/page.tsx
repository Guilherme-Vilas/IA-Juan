import { Header } from "@/components/layout/header";
import { agentApi } from "@/lib/api";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { AgentSettings, PlaybookTemplate, CustomFieldDef } from "@/lib/types";
import { AgentSettingsForm } from "./_components/agent-settings-form";
import { CustomFieldsEditor } from "./_components/custom-fields-editor";
import { CaptureCard } from "./_components/capture-card";

export const dynamic = "force-dynamic";

async function getFieldDefs(tenantId: number): Promise<CustomFieldDef[]> {
  const { rows } = await pool.query<CustomFieldDef>(
    `SELECT id, key, label, type, options, position FROM custom_field_defs
      WHERE tenant_id = $1 ORDER BY position ASC, id ASC`,
    [tenantId],
  );
  return rows;
}

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  const [{ settings, playbook_slug }, { playbooks }, fieldDefs] = (await Promise.all([
    agentApi(tenant.slug).get(),
    agentApi(tenant.slug).playbooks(),
    getFieldDefs(tenant.id),
  ])) as [
    { settings: AgentSettings | null; playbook_slug: string | null },
    { playbooks: PlaybookTemplate[] },
    CustomFieldDef[],
  ];

  const resolvedSettings: AgentSettings =
    settings ?? {
      tenant_id: tenant.id,
      agent_name: "Stella",
      tone: "consultivo, humano e objetivo",
      products: [],
      regions: [],
      qualification_rules: "",
      handoff_rules: "",
      updated_at: new Date().toISOString(),
    };

  return (
    <>
      <Header title="Configurações" subtitle={`${tenant.name} · agente e playbook`} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <AgentSettingsForm
          tenantSlug={tenant.slug}
          settings={resolvedSettings}
          playbookSlug={playbook_slug}
          playbooks={playbooks}
        />
        <CustomFieldsEditor initial={fieldDefs} />
        <CaptureCard />
      </div>
    </>
  );
}
