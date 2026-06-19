import { NextResponse } from "next/server";
import { crmApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

export async function PATCH(req: Request) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as { mode?: "manual" | "round_robin" };
  if (body?.mode !== "manual" && body?.mode !== "round_robin") {
    return NextResponse.json({ error: "mode inválido" }, { status: 400 });
  }
  try {
    return NextResponse.json(await crmApi(tenant.slug).setDistribution(body.mode));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
