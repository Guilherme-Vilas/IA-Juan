import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

// Proxy genérico — encaminha as chamadas do client pra /admin/* do Fastify,
// autenticando como o USUÁRIO logado (JWT do cookie httpOnly como Bearer).
// O Fastify valida o vínculo user<->tenant; sem sessão -> 401.
async function proxy(req: Request, params: { path: string[] }) {
  const subPath = params.path.join("/");
  const url = new URL(req.url);
  const target = `${FASTIFY}/admin/${subPath}${url.search}`;
  const body = req.method !== "GET" && req.method !== "DELETE" ? await req.text() : undefined;

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const res = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}
export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}
