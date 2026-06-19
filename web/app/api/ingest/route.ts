import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await crmApi(tenant.slug).ingest());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { capture_greeting?: string };
  try {
    return NextResponse.json(await crmApi(tenant.slug).setGreeting(body?.capture_greeting ?? ""));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
