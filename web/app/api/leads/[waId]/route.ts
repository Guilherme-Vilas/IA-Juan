import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { Lead } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const { rows } = await pool.query<Lead>(
    `SELECT * FROM leads WHERE tenant_id = $1 AND wa_id = $2 LIMIT 1`,
    [tenant.id, params.waId],
  );
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
