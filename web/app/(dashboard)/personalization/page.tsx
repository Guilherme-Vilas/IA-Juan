import { Header } from "@/components/layout/header";
import { agentApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import { PersonalizationForm } from "./_components/personalization-form";

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
        <PersonalizationForm tenantSlug={tenant.slug} initial={prompts} error={error} />
      </div>
    </>
  );
}
