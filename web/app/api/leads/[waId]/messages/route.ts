import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { Message } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const { rows } = await pool.query<Message>(
    `SELECT m.* FROM messages m
       JOIN leads l ON l.id = m.lead_id
      WHERE l.wa_id = $1
      ORDER BY m.id ASC
      LIMIT 500`,
    [params.waId],
  );
  return NextResponse.json(rows);
}
