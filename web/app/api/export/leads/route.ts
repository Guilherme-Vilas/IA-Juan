import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCurrentTenant } from "@/lib/tenant";

// Exportação CSV dos leads do tenant atual — download direto do navegador
// (com sessão), separador ";" e BOM pro Excel abrir com acentos certos.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tenant = await getCurrentTenant();

  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT l.wa_id, l.nome, l.source, l.state, l.status, l.closed_reason,
            l.outcome, l.outcome_reason, l.value_cents, l.score, l.score_label,
            ps.name AS etapa, u.name AS responsavel, l.slots, l.created_at, l.updated_at
       FROM leads l
       LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
       LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE l.tenant_id = $1
      ORDER BY l.updated_at DESC
      LIMIT 10000`,
    [tenant.id],
  );

  const cols = [
    "wa_id", "nome", "source", "state", "status", "closed_reason", "outcome", "outcome_reason",
    "value_cents", "score", "score_label", "etapa", "responsavel", "slots", "created_at", "updated_at",
  ];
  const esc = (v: unknown): string => {
    if (v == null) return "";
    const str = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${tenant.slug}.csv"`,
    },
  });
}
