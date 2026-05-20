import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export type LeadState =
  | "S0_ABERTURA"
  | "S1_DESCOBERTA"
  | "S2_QUALIFICACAO"
  | "S3_EDUCACAO"
  | "S4_AGENDAMENTO"
  | "S5_CONFIRMADO"
  | "HANDOFF";

export type LeadStatus = "open" | "closed";
export type ClosedReason =
  | "scheduled"
  | "not_interested"
  | "postponed"
  | "handoff"
  | "no_response";
export type MeetingChannel = "ligacao" | "video";

export type Slots = {
  nome?: string;
  interesse?: "imovel" | "auto" | "investimento" | "outro";
  capacidade_mensal?: number;
  valor_bem?: number;
  prazo_meses?: number;
  intencao_lance?: boolean;
  observacoes?: string;
  // qualificação Juan (BANT)
  sabe_consorcio?: boolean;         // tem clareza do que é consórcio?
  prazo_decisao?: string;           // "proximos_meses" | "sem_pressa" | "indefinido" | livre
  fecha_se_proposta_boa?: boolean;  // commitment se proposta for adequada?
  decisao_com_conjuge?: boolean;    // decide sozinho (false) ou com parceiro (true)?
  mora_exterior?: boolean;          // brasileiro que mora fora
};

export type LeadRow = {
  id: number;
  wa_id: string;
  nome: string | null;
  source: string | null;
  state: LeadState;
  slots: Slots;
  paused: boolean;
  status: LeadStatus;
  closed_reason: ClosedReason | null;
  closed_at: Date | null;
  last_user_at: Date | null;
  last_assistant_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function upsertLead(waId: string, patch: Partial<LeadRow> = {}): Promise<LeadRow> {
  const { rows } = await pool.query<LeadRow>(
    `INSERT INTO leads (wa_id, nome, source, state, slots)
     VALUES ($1, $2, $3, COALESCE($4, 'S0_ABERTURA'), COALESCE($5, '{}'::jsonb))
     ON CONFLICT (wa_id) DO UPDATE SET
       nome   = COALESCE(EXCLUDED.nome, leads.nome),
       source = COALESCE(EXCLUDED.source, leads.source),
       updated_at = now()
     RETURNING *`,
    [waId, patch.nome ?? null, patch.source ?? null, patch.state ?? null, patch.slots ?? null],
  );
  return rows[0]!;
}

export async function getLead(waId: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(`SELECT * FROM leads WHERE wa_id = $1`, [waId]);
  return rows[0] ?? null;
}

export async function listLeads(limit = 50): Promise<LeadRow[]> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function updateLead(
  waId: string,
  patch: Partial<Pick<LeadRow, "state" | "slots" | "nome" | "paused">>,
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(k === "slots" ? JSON.stringify(v) : v);
  }
  if (!fields.length) return;
  values.push(waId);
  await pool.query(
    `UPDATE leads SET ${fields.join(", ")}, updated_at = now() WHERE wa_id = $${i}`,
    values,
  );
}

export async function markLastActivity(
  waId: string,
  who: "user" | "assistant",
  at: Date = new Date(),
) {
  const col = who === "user" ? "last_user_at" : "last_assistant_at";
  await pool.query(
    `UPDATE leads SET ${col} = $1, updated_at = now() WHERE wa_id = $2`,
    [at, waId],
  );
}

export async function closeConversation(waId: string, reason: ClosedReason) {
  await pool.query(
    `UPDATE leads
       SET status = 'closed',
           closed_reason = $1,
           closed_at = now(),
           updated_at = now()
     WHERE wa_id = $2`,
    [reason, waId],
  );
}

export async function reopenConversation(waId: string) {
  await pool.query(
    `UPDATE leads
       SET status = 'open',
           closed_reason = NULL,
           closed_at = NULL,
           updated_at = now()
     WHERE wa_id = $1`,
    [waId],
  );
}

export async function logMessage(
  leadId: number,
  direction: "in" | "out",
  role: "user" | "assistant" | "system",
  content: string,
): Promise<{ id: number; created_at: Date }> {
  const { rows } = await pool.query<{ id: number; created_at: Date }>(
    `INSERT INTO messages (lead_id, direction, role, content)
     VALUES ($1,$2,$3,$4)
     RETURNING id, created_at`,
    [leadId, direction, role, content],
  );
  return rows[0]!;
}

export type MessageRow = {
  id: number;
  lead_id: number;
  direction: "in" | "out";
  role: "user" | "assistant" | "system";
  content: string;
  created_at: Date;
};

export async function listMessages(leadId: number, sinceId = 0, limit = 200): Promise<MessageRow[]> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT * FROM messages
       WHERE lead_id = $1 AND id > $2
       ORDER BY id ASC
       LIMIT $3`,
    [leadId, sinceId, limit],
  );
  return rows;
}

export async function recordAppointment(
  leadId: number,
  eventId: string,
  scheduledAt: Date,
  channel: MeetingChannel | null = null,
) {
  await pool.query(
    `INSERT INTO appointments (lead_id, calendar_event_id, scheduled_at, status, meeting_channel)
     VALUES ($1, $2, $3, 'scheduled', $4)`,
    [leadId, eventId, scheduledAt, channel],
  );
}

export async function resetLead(waId: string) {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM leads WHERE wa_id = $1`, [waId]);
  const id = rows[0]?.id;
  if (id) {
    await pool.query(`DELETE FROM messages WHERE lead_id = $1`, [id]);
    await pool.query(`DELETE FROM appointments WHERE lead_id = $1`, [id]);
  }
  await pool.query(`DELETE FROM leads WHERE wa_id = $1`, [waId]);
}
