import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json().catch(() => ({}))) as { done?: boolean };
  try {
    return NextResponse.json(await crmApi(tenant.slug).setTaskDone(Number(params.id), body?.done ?? true));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await crmApi(tenant.slug).deleteTask(Number(params.id)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
