import { LogoMark } from "@/components/ui/logo";
import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convite · Vita OS" };

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

type InviteInfo = {
  status: "valid" | "used" | "expired" | "not_found";
  type?: "new_tenant" | "add_user";
  role?: string;
  email?: string | null;
  tenant?: { slug: string; name: string } | null;
  expires_at?: string;
};

async function fetchInvite(token: string): Promise<InviteInfo> {
  try {
    const res = await fetch(`${FASTIFY}/invite/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "not_found" };
    return (await res.json()) as InviteInfo;
  } catch {
    return { status: "not_found" };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-page-glow px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="mb-4 h-12 w-12 border border-line" />
          <h1 className="font-serif text-2xl text-ink">Vita OS</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas-surface p-6 text-center shadow-elevated">
      <h2 className="font-serif text-lg text-ink">{title}</h2>
      <p className="mt-2 text-[13px] text-ink-muted">{message}</p>
      <a
        href="/login"
        className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-[13px] text-ink-soft transition-colors hover:bg-canvas-surface-2"
      >
        Ir para o login
      </a>
    </div>
  );
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const info = await fetchInvite(params.token);

  if (info.status === "not_found") {
    return (
      <Shell>
        <ErrorCard title="Convite inválido" message="Este link não existe ou foi revogado." />
      </Shell>
    );
  }
  if (info.status === "expired") {
    return (
      <Shell>
        <ErrorCard
          title="Convite expirado"
          message="O prazo deste convite acabou. Peça um novo link ao administrador."
        />
      </Shell>
    );
  }
  if (info.status === "used") {
    return (
      <Shell>
        <ErrorCard
          title="Convite já utilizado"
          message="Esta conta já foi criada. Se for você, entre pelo login."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <AcceptForm
        token={params.token}
        type={info.type ?? "add_user"}
        role={info.role ?? "owner"}
        lockedEmail={info.email ?? null}
        tenantName={info.tenant?.name ?? null}
      />
    </Shell>
  );
}
