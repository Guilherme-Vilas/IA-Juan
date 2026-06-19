import { NextResponse } from "next/server";
import { propertiesApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { csv?: string };
  try {
    return NextResponse.json(await propertiesApi(tenant.slug).importCsv(body?.csv ?? ""));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
