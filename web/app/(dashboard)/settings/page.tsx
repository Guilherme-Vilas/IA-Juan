import { Header } from "@/components/layout/header";
import { agentApi } from "@/lib/api";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { AgentSettings, PlaybookTemplate, CustomFieldDef } from "@/lib/types";
import { AgentSettingsForm } from "./_components/agent-settings-form";
import { CustomFieldsEditor } from "./_components/custom-fields-editor";
import { CaptureCard } from "./_components/capture-card";
import { FollowupEditor } from "./_components/followup-editor";
import { WebhooksManager } from "./_components/webhooks-manager";
import { adminCall } from "@/lib/api";

export const dynamic = "force-dynamic";

async function getFieldDefs(tenantId: number): Promise<CustomFieldDef[]> {
  const { rows } = await pool.query<CustomFieldDef>(
    `SELECT id, key, label, type, options, position FROM custom_field_defs
      WHERE tenant_id = $1 ORDER BY position ASC, id ASC`,
    [tenantId],
  );
  return rows;
}

type FollowupConfig = {
  enabled: boolean;
  steps: Array<{ delay_minutes: number; text: string }>;
  close_after_minutes: number;
  work_hours_only: boolean;
};
type WebhookRow = {
  id: number;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  last_ok_at: string | null;
  last_error: string;
};

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  const [{ settings, playbook_slug }, { playbooks }, fieldDefs, followupRes, webhooksRes] = (await Promise.all([
    agentApi(tenant.slug).get().catch(() => ({ settings: null, playbook_slug: null })),
    agentApi(tenant.slug).playbooks().catch(() => ({ playbooks: [] })),
    getFieldDefs(tenant.id).catch(() => []),
    adminCall(`/admin/tenants/${tenant.slug}/followups`, { method: "GET" }).catch(() => null),
    adminCall(`/admin/tenants/${tenant.slug}/webhooks`, { method: "GET" }).catch(() => null),
  ])) as [
    { settings: AgentSettings | null; playbook_slug: string | null },
    { playbooks: PlaybookTemplate[] },
    CustomFieldDef[],
    { config: FollowupConfig } | null,
    { webhooks: WebhookRow[]; events: string[] } | null,
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
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        <AgentSettingsForm
          tenantSlug={tenant.slug}
          settings={resolvedSettings}
          playbookSlug={playbook_slug}
          playbooks={playbooks}
        />
        {followupRes && <FollowupEditor tenantSlug={tenant.slug} initial={followupRes.config} />}
        <CustomFieldsEditor initial={fieldDefs} />
        <CaptureCard />
        {webhooksRes && (
          <WebhooksManager tenantSlug={tenant.slug} initial={webhooksRes.webhooks} events={webhooksRes.events} />
        )}
      </div>
    </>
  );
}
