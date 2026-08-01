import { NextResponse } from "next/server";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

// Proxy público do reset de senha por código.
export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${FASTIFY}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "serviço indisponível" }, { status: 502 });
  }
}
