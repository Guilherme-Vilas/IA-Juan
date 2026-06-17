import { cookies } from "next/headers";
import { cache } from "react";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

export const SESSION_COOKIE = "vita_session";

export type SessionTenant = { tenant_id: number; slug: string; name: string; role: string };
export type Session = {
  kind: "user" | "service";
  userId?: number;
  is_superadmin: boolean;
  tenants: SessionTenant[];
};

// Lê o JWT do cookie httpOnly e valida no Fastify (/auth/me).
// `cache()` dedupe a chamada dentro do mesmo request (SSR pode chamar várias vezes).
export const getSession = cache(async (): Promise<Session | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${FASTIFY}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Session;
  } catch {
    return null;
  }
});

// Token cru pra repassar como Bearer nas chamadas server->Fastify.
export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}
