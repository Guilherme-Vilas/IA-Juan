import { NextResponse } from "next/server";
import { leadActionsApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";

type Body =
  | { action: "pause" }
  | { action: "reopen" }
  | { action: "close"; reason: string }
  | { action: "send"; text: string }
  | { action: "state"; state: string };

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const body = (await req.json()) as Body;
  const api = leadActionsApi(tenant.slug);
  try {
    switch (body.action) {
      case "pause":
        return NextResponse.json(await api.pause(params.waId));
      case "reopen":
        return NextResponse.json(await api.reopen(params.waId));
      case "close":
        return NextResponse.json(await api.close(params.waId, body.reason));
      case "send":
        return NextResponse.json(await api.send(params.waId, body.text));
      case "state":
        return NextResponse.json(await api.setState(params.waId, body.state));
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
