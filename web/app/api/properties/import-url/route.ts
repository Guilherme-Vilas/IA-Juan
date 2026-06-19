import { NextResponse } from "next/server";
import { propertiesApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export const maxDuration = 120;

export async function POST(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { url?: string };
  if (!body?.url) return NextResponse.json({ error: "url obrigatória" }, { status: 400 });
  try {
    return NextResponse.json(await propertiesApi(tenant.slug).importUrl(body.url));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
