import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { Lead } from "@/lib/types";

export async function GET() {
  const { rows } = await pool.query<Lead>(`
    SELECT id, wa_id, nome, source, state, slots, paused, status, closed_reason,
           closed_at, last_user_at, last_assistant_at, created_at, updated_at
      FROM leads
     ORDER BY updated_at DESC
     LIMIT 500
  `);
  return NextResponse.json(rows);
}
