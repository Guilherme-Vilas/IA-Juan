import { NextResponse } from "next/server";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

// Proxy PÚBLICO (sem auth) do aceite de convite -> Fastify POST /invite/:token/accept.
export async function POST(req: Request, ctx: { params: { token: string } }) {
  const body = await req.text();
  try {
    const res = await fetch(`${FASTIFY}/invite/${encodeURIComponent(ctx.params.token)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
