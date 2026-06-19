import { NextResponse } from "next/server";
import { propertiesApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export const maxDuration = 120; // extracao da IA pode demorar

export async function POST(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { filename?: string; base64?: string };
  if (!body?.base64) return NextResponse.json({ error: "arquivo obrigatório" }, { status: 400 });
  try {
    return NextResponse.json(
      await propertiesApi(tenant.slug).importDocument(body.filename ?? "arquivo.csv", body.base64),
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
