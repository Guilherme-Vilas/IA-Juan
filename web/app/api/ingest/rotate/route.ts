import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST() {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await crmApi(tenant.slug).rotateIngest());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
