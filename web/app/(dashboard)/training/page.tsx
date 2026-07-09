import { Header } from "@/components/layout/header";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession } from "@/lib/session";
import { TrainingHub } from "./_components/training-hub";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const [tenant, session] = await Promise.all([getCurrentTenant(), getSession()]);
  return (
    <>
      <Header
        title="Treinamentos"
        subtitle="Aprenda a extrair o máximo da plataforma — vídeos curtos, direto ao ponto"
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <TrainingHub tenantSlug={tenant.slug} isSuperadmin={!!session?.is_superadmin} />
      </div>
    </>
  );
}
