import { NextResponse } from "next/server";
import { pipelineApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await pipelineApi(tenant.slug).get());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { stages?: unknown[] };
  try {
    return NextResponse.json(await pipelineApi(tenant.slug).saveStages(body.stages ?? []));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
