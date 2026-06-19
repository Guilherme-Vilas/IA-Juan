import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function PATCH(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { values?: Record<string, unknown> };
  try {
    return NextResponse.json(await crmApi(tenant.slug).setCustom(params.waId, body?.values ?? {}));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
