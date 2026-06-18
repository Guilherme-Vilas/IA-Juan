import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { listTenantsForUI } from "@/lib/tenant";
import { adminCall } from "@/lib/api";
import { InviteManager, type InviteRow } from "./invite-manager";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_superadmin) redirect("/leads");

  let invites: InviteRow[] = [];
  let error: string | null = null;
  try {
    const data = (await adminCall("/auth/invites", { method: "GET" })) as { invites: InviteRow[] };
    invites = data.invites;
  } catch (err) {
    error = String(err);
  }
  const tenants = await listTenantsForUI();

  return (
    <>
      <Header
        title="Convites"
        subtitle="Gere links com validade para abrir empresas ou dar acesso a usuários"
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <InviteManager
          tenants={tenants.map((t) => ({ slug: t.slug, name: t.name }))}
          initialInvites={invites}
          error={error}
        />
      </div>
    </>
  );
}
