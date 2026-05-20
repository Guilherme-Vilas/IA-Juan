import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query<{ state: string; count: string }>(
    `SELECT state, COUNT(*)::text AS count FROM leads GROUP BY state ORDER BY state`,
  );
  const closed = await pool.query<{ reason: string; count: string }>(
    `SELECT COALESCE(closed_reason, 'aberto') AS reason, COUNT(*)::text AS count
       FROM leads
       WHERE status = 'closed'
      GROUP BY closed_reason`,
  );
  return NextResponse.json({
    funnel: rows.map((r) => ({ state: r.state, count: Number(r.count) })),
    closed: closed.rows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
  });
}
