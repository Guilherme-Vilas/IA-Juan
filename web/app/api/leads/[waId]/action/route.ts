import { NextResponse } from "next/server";
import { adminApi } from "@/lib/api";

type Body =
  | { action: "pause" }
  | { action: "reopen" }
  | { action: "close"; reason: string }
  | { action: "send"; text: string }
  | { action: "state"; state: string };

export async function POST(req: Request, { params }: { params: { waId: string } }) {
  const body = (await req.json()) as Body;
  try {
    switch (body.action) {
      case "pause":
        return NextResponse.json(await adminApi.pause(params.waId));
      case "reopen":
        return NextResponse.json(await adminApi.reopen(params.waId));
      case "close":
        return NextResponse.json(await adminApi.close(params.waId, body.reason));
      case "send":
        return NextResponse.json(await adminApi.send(params.waId, body.text));
      case "state":
        return NextResponse.json(await adminApi.setState(params.waId, body.state));
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
