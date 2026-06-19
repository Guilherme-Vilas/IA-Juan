import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { value?: number | null };
  try {
    return NextResponse.json(await crmApi(tenant.slug).setValue(params.waId, body?.value ?? null));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
