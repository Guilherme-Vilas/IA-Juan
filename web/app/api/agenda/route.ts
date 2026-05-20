import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(
    `SELECT a.id, a.scheduled_at, a.meeting_channel, a.status, a.calendar_event_id,
            l.wa_id, l.nome, l.slots
       FROM appointments a
       JOIN leads l ON l.id = a.lead_id
      WHERE a.scheduled_at > now() - interval '7 days'
      ORDER BY a.scheduled_at ASC
      LIMIT 200`,
  );
  return NextResponse.json(rows);
}
