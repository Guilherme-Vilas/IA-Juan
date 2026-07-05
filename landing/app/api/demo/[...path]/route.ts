import { NextResponse } from "next/server";

// Proxy da demo: navegador → landing (mesmo domínio, sem CORS) → Fastify.
// Na rede do compose o backend é o serviço `app`; em dev local, localhost.
const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://app:3000";

export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  const subPath = ctx.params.path.join("/");
  if (!["start", "message", "capture"].includes(subPath)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.text();
  try {
    const res = await fetch(`${FASTIFY}/demo/${subPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // repassa o IP real pro rate-limit do backend
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      body: body.length > 0 ? body : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "demo temporariamente indisponível — tente de novo em instantes" },
      { status: 502 },
    );
  }
}
