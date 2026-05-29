import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();
  const { rows } = await pool.query(
    `SELECT a.id, a.scheduled_at, a.meeting_channel, a.status, a.calendar_event_id,
            l.wa_id, l.nome, l.slots
       FROM appointments a
       JOIN leads l ON l.id = a.lead_id
      WHERE a.tenant_id = $1
        AND a.scheduled_at > now() - interval '7 days'
      ORDER BY a.scheduled_at ASC
      LIMIT 200`,
    [tenant.id],
  );
  return NextResponse.json(rows);
}
