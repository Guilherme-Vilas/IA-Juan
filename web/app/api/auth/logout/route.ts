import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

function clear() {
  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return out;
}

export async function POST() {
  return clear();
}

export async function GET(req: Request) {
  // Permite logout via link simples → limpa cookie e manda pro /login.
  const url = new URL("/login", req.url);
  const out = NextResponse.redirect(url);
  out.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return out;
}
