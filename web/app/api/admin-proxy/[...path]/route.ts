import { NextResponse } from "next/server";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ADMIN_API_TOKEN ?? "";

// Proxy genérico — encaminha qualquer chamada do front pra /admin/* do Fastify,
// adicionando o token de admin. Evita criar 1 route handler por endpoint.
async function proxy(req: Request, params: { path: string[] }) {
  const subPath = params.path.join("/");
  const url = new URL(req.url);
  const target = `${FASTIFY}/admin/${subPath}${url.search}`;
  const body = req.method !== "GET" && req.method !== "DELETE" ? await req.text() : undefined;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": TOKEN,
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
