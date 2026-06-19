import { NextResponse } from "next/server";
import { automationsApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await automationsApi(tenant.slug).get(Number(params.id)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as Record<string, unknown>;
  try {
    return NextResponse.json(await automationsApi(tenant.slug).update(Number(params.id), body));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await automationsApi(tenant.slug).remove(Number(params.id)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
