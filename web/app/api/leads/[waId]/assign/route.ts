import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { user_id?: number | null };
  try {
    return NextResponse.json(await crmApi(tenant.slug).assign(params.waId, body?.user_id ?? null));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
