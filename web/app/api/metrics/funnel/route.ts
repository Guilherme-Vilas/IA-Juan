import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  const { rows } = await pool.query<{ state: string; count: string }>(
    `SELECT state, COUNT(*)::text AS count FROM leads WHERE tenant_id = $1 GROUP BY state ORDER BY state`,
    [tenant.id],
  );
  const closed = await pool.query<{ reason: string; count: string }>(
    `SELECT COALESCE(closed_reason, 'aberto') AS reason, COUNT(*)::text AS count
       FROM leads
      WHERE tenant_id = $1 AND status = 'closed'
      GROUP BY closed_reason`,
    [tenant.id],
  );
  return NextResponse.json({
    funnel: rows.map((r) => ({ state: r.state, count: Number(r.count) })),
    closed: closed.rows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
  });
}
