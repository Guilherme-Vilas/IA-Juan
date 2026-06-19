import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import type { Lead } from "@/lib/types";

export async function GET() {
  const tenant = await getCurrentTenant();
  const { rows } = await pool.query<Lead>(
    `SELECT id, tenant_id, wa_id, nome, source, state, slots, paused, status, closed_reason,
            closed_at, last_user_at, last_assistant_at, created_at, updated_at,
            pipeline_stage_id, stage_manual, outcome, outcome_reason, outcome_at, stage_entered_at,
            value_cents, assigned_user_id
       FROM leads
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT 500`,
    [tenant.id],
  );
  return NextResponse.json(rows);
}
