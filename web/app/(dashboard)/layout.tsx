import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { HelpAssistant } from "@/components/help-assistant";
import { WhatsappAlert } from "@/components/whatsapp-alert";
import { getSession } from "@/lib/session";
import { getCurrentTenant } from "@/lib/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defesa server-side: cookie presente mas inválido/expirado -> /login.
  const session = await getSession();
  if (!session) redirect("/login");

  // Treinamentos: aparece se o tenant atual está liberado (superadmin vê sempre).
  let showTraining = session.is_superadmin;
  let tenantSlug: string | null = null;
  try {
    const tenant = await getCurrentTenant();
    showTraining = session.is_superadmin || tenant.training_enabled;
    tenantSlug = tenant.slug;
  } catch {
    /* usuário sem tenants — segue sem o item */
  }

  const firstTenant = session.tenants[0];
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isSuperadmin={session.is_superadmin}
        showTraining={showTraining}
        userLabel={firstTenant?.name ?? (session.is_superadmin ? "Administrador" : "Usuário")}
        userRole={session.is_superadmin ? "Superadmin" : (firstTenant?.role ?? "—")}
      />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      {/* assistente de suporte in-app (tira-dúvidas com IA) */}
      {tenantSlug && <HelpAssistant tenantSlug={tenantSlug} />}
      {/* alerta global: WhatsApp desconectado + reconexão por QR no painel */}
      {tenantSlug && <WhatsappAlert tenantSlug={tenantSlug} />}
    </div>
  );
}
