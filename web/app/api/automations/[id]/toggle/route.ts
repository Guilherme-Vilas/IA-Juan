import { NextResponse } from "next/server";
import { automationsApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  try {
    return NextResponse.json(await automationsApi(tenant.slug).toggle(Number(params.id), body?.enabled ?? true));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
