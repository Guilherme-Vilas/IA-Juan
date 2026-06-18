import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

// Proxy das rotas de convite do Fastify (/auth/invites). Autentica como o
// usuário logado (JWT do cookie httpOnly); o Fastify exige superadmin.
async function forward(req: Request, method: "GET" | "POST") {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = method === "POST" ? await req.text() : undefined;
  try {
    const res = await fetch(`${FASTIFY}/auth/invites`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

export async function GET(req: Request) {
  return forward(req, "GET");
}
export async function POST(req: Request) {
  return forward(req, "POST");
}
