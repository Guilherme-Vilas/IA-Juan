import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await crmApi(tenant.slug).notes(params.waId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { body?: string };
  try {
    return NextResponse.json(await crmApi(tenant.slug).addNote(params.waId, body?.body ?? ""));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
