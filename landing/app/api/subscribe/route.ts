import { NextResponse } from "next/server";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://app:3000";

// Proxy público da inscrição de e-mail (rate limit vive no Fastify).
export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${FASTIFY}/mkt/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "serviço indisponível — tente de novo" }, { status: 502 });
  }
}
