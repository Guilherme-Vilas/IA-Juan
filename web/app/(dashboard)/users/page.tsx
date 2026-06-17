import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { listTenantsForUI } from "@/lib/tenant";
import { adminCall } from "@/lib/api";
import { CreateUserForm } from "./create-user-form";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: number;
  email: string;
  name: string;
  is_superadmin: boolean;
  active: boolean;
  tenants: Array<{ slug: string; name: string; role: string }>;
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_superadmin) redirect("/leads");

  let users: AdminUser[] = [];
  let error: string | null = null;
  try {
    const data = (await adminCall("/auth/users", { method: "GET" })) as { users: AdminUser[] };
    users = data.users;
  } catch (err) {
    error = String(err);
  }
  const tenants = await listTenantsForUI();

  return (
    <>
      <Header title="Usuários" subtitle="Crie acessos e vincule cada usuário ao seu tenant" />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Lista */}
          <section>
            {error && (
              <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas-surface text-left text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-3 font-medium">Usuário</th>
                    <th className="px-4 py-3 font-medium">Tenants</th>
                    <th className="px-4 py-3 font-medium">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-ink-muted">
                        Nenhum usuário ainda.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-ink">{u.name || u.email}</div>
                        <div className="text-xs text-ink-faint">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.tenants.length === 0 ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.tenants.map((t) => (
                              <span
                                key={t.slug}
                                className="rounded-md border border-line bg-canvas-surface px-2 py-0.5 text-xs text-ink-soft"
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_superadmin ? (
                          <span className="rounded-md border border-accent-bronze/40 bg-accent-bronze/10 px-2 py-0.5 text-xs text-accent-bronze-soft">
                            Superadmin
                          </span>
                        ) : (
                          <span className="text-ink-muted">{u.tenants[0]?.role ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Criar */}
          <CreateUserForm tenants={tenants.map((t) => ({ slug: t.slug, name: t.name }))} />
        </div>
      </div>
    </>
  );
}
