import { NextResponse } from "next/server";
import { pipelineApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { to_stage_id?: number; reason?: string };
  if (!body?.to_stage_id) {
    return NextResponse.json({ error: "to_stage_id obrigatório" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await pipelineApi(tenant.slug).moveLead(params.waId, body.to_stage_id, body.reason),
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
