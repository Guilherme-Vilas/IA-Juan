import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await crmApi(tenant.slug).members());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
