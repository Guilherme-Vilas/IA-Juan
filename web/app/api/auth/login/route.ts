import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { TENANT_COOKIE } from "@/lib/tenant-client";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "email e senha obrigatórios" }, { status: 400 });
  }

  let data: { token?: string; user?: unknown; tenants?: Array<{ slug: string }> };
  try {
    const res = await fetch(`${FASTIFY}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
    });
    data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: (data as { error?: string })?.error ?? "credenciais inválidas" }, { status: res.status });
    }
  } catch (err) {
    return NextResponse.json({ error: `falha ao conectar: ${String(err)}` }, { status: 502 });
  }

  if (!data.token) {
    return NextResponse.json({ error: "resposta inválida do servidor" }, { status: 502 });
  }

  const out = NextResponse.json({ ok: true, user: data.user, tenants: data.tenants ?? [] });
  // Cookie httpOnly com o JWT — JS não lê (XSS-safe). 12h de validade.
  out.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  // Seleciona o primeiro tenant do usuário por padrão.
  const firstSlug = data.tenants?.[0]?.slug;
  if (firstSlug) {
    out.cookies.set(TENANT_COOKIE, firstSlug, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return out;
}
