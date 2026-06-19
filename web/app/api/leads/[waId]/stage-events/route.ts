import { NextResponse } from "next/server";
import { pipelineApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  try {
    return NextResponse.json(await pipelineApi(tenant.slug).stageEvents(params.waId));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
