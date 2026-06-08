import { Header } from "@/components/layout/header";
import { agentApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import type { AgentSettings, PlaybookTemplate } from "@/lib/types";
import { AgentSettingsForm } from "./_components/agent-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  const [{ settings, playbook_slug }, { playbooks }] = (await Promise.all([
    agentApi(tenant.slug).get(),
    agentApi(tenant.slug).playbooks(),
  ])) as [
    { settings: AgentSettings | null; playbook_slug: string | null },
    { playbooks: PlaybookTemplate[] },
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
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AgentSettingsForm
          tenantSlug={tenant.slug}
          settings={resolvedSettings}
          playbookSlug={playbook_slug}
          playbooks={playbooks}
        />
      </div>
    </>
  );
}
