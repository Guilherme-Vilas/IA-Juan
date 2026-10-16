import { Header } from "@/components/layout/header";
import { agentApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import { PersonalizationForm } from "./_components/personalization-form";
import { SandboxChat } from "./_components/sandbox-chat";

export const dynamic = "force-dynamic";

type Prompts = { system: string; knowledge: string; objections: string; examples: string };

export default async function PersonalizationPage() {
  const tenant = await getCurrentTenant();
  let prompts: Prompts = { system: "", knowledge: "", objections: "", examples: "" };
  let error: string | null = null;
  try {
    const data = (await agentApi(tenant.slug).getPrompts()) as { prompts: Prompts };
    prompts = data.prompts;
  } catch (err) {
    error = String(err);
  }

  return (
    <>
      <Header
        title="Personalização da IA"
        subtitle={`${tenant.name} · ajuste como o agente conversa`}
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <PersonalizationForm tenantSlug={tenant.slug} initial={prompts} error={error} />
          <div className="xl:sticky xl:top-20 xl:self-start">
            <SandboxChat tenantSlug={tenant.slug} />
          </div>
        </div>
      </div>
    </>
  );
}
