import { NextResponse } from "next/server";
import { propertiesApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await propertiesApi(tenant.slug).list());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as Record<string, unknown>;
  try {
    return NextResponse.json(await propertiesApi(tenant.slug).create(body));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
