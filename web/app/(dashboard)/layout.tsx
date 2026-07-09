import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getSession } from "@/lib/session";
import { getCurrentTenant } from "@/lib/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defesa server-side: cookie presente mas inválido/expirado -> /login.
  const session = await getSession();
  if (!session) redirect("/login");

  // Treinamentos: aparece se o tenant atual está liberado (superadmin vê sempre).
  let showTraining = session.is_superadmin;
  try {
    const tenant = await getCurrentTenant();
    showTraining = session.is_superadmin || tenant.training_enabled;
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
    </div>
  );
}
