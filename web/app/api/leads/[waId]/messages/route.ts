import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { Message } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { waId: string } }) {
  const tenant = await getCurrentTenant();
  const { rows } = await pool.query<Message>(
    `SELECT m.* FROM messages m
       JOIN leads l ON l.id = m.lead_id
      WHERE l.tenant_id = $1 AND l.wa_id = $2
      ORDER BY m.id ASC
      LIMIT 500`,
    [tenant.id, params.waId],
  );
  return NextResponse.json(rows);
}
