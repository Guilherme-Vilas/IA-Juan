import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { Lead } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const { rows } = await pool.query<Lead>(
    `SELECT * FROM leads WHERE wa_id = $1 LIMIT 1`,
    [params.waId],
  );
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
