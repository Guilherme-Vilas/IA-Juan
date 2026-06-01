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
  profissao?: string;               // com o que trabalha (texto livre curto)
  renda_aproximada?: string;        // faixa em string: "4-8k", "8-15k", "15-25k", "25k+"
  modelo_carro?: string;            // modelo/marca pretendido (texto livre)
  interesse?: "imovel" | "auto" | "investimento" | "outro";
  capacidade_mensal?: number;       // parcela suportada por mes (R$)
  valor_bem?: number;               // valor do bem/carta/imovel (R$)
  prazo_meses?: number;
  intencao_lance?: boolean;
  observacoes?: string;
  // qualificação Juan (BANT)
  sabe_consorcio?: boolean;
  prazo_decisao?: string;
  fecha_se_proposta_boa?: boolean;
  decisao_com_conjuge?: boolean;
  mora_exterior?: boolean;
  // slots imobiliarios (tenant facilita / apolar)
  entrada_disponivel?: number;      // R$ disponiveis pra entrada
  usa_fgts?: boolean;
  finalidade?: "moradia" | "investimento" | "renda_locacao";
  tipo_imovel?: "lancamento" | "usado" | "comercial";
  regiao_interesse?: string;        // bairro/cidade preferida
  pretende_financiar?: boolean;
  ja_visitou_imovel?: boolean;
};

export type LeadRow = {
  id: number;
  tenant_id: number;
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

export async function upsertLead(
  tenantId: number,
  waId: string,
  patch: Partial<LeadRow> = {},
): Promise<LeadRow> {
  const { rows } = await pool.query<LeadRow>(
    `INSERT INTO leads (tenant_id, wa_id, nome, source, state, slots)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'S0_ABERTURA'), COALESCE($6, '{}'::jsonb))
     ON CONFLICT (tenant_id, wa_id) DO UPDATE SET
       nome   = COALESCE(EXCLUDED.nome, leads.nome),
       source = COALESCE(EXCLUDED.source, leads.source),
       updated_at = now()
     RETURNING *`,
    [
      tenantId,
      waId,
      patch.nome ?? null,
      patch.source ?? null,
      patch.state ?? null,
      patch.slots ?? null,
    ],
  );
  return rows[0]!;
}

export async function getLead(tenantId: number, waId: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  return rows[0] ?? null;
}

export async function listLeads(tenantId: number, limit = 50): Promise<LeadRow[]> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

export async function updateLead(
  tenantId: number,
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
  values.push(tenantId, waId);
  await pool.query(
    `UPDATE leads SET ${fields.join(", ")}, updated_at = now() WHERE tenant_id = $${i++} AND wa_id = $${i}`,
    values,
  );
}

export async function markLastActivity(
  tenantId: number,
  waId: string,
  who: "user" | "assistant",
  at: Date = new Date(),
) {
  const col = who === "user" ? "last_user_at" : "last_assistant_at";
  await pool.query(
    `UPDATE leads SET ${col} = $1, updated_at = now() WHERE tenant_id = $2 AND wa_id = $3`,
    [at, tenantId, waId],
  );
}

export async function closeConversation(tenantId: number, waId: string, reason: ClosedReason) {
  await pool.query(
    `UPDATE leads
       SET status = 'closed',
           closed_reason = $1,
           closed_at = now(),
           updated_at = now()
     WHERE tenant_id = $2 AND wa_id = $3`,
    [reason, tenantId, waId],
  );
}

export async function reopenConversation(tenantId: number, waId: string) {
  await pool.query(
    `UPDATE leads
       SET status = 'open',
           closed_reason = NULL,
           closed_at = NULL,
           updated_at = now()
     WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
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
  tenantId: number,
  leadId: number,
  eventId: string,
  scheduledAt: Date,
  channel: MeetingChannel | null = null,
) {
  await pool.query(
    `INSERT INTO appointments (tenant_id, lead_id, calendar_event_id, scheduled_at, status, meeting_channel)
     VALUES ($1, $2, $3, $4, 'scheduled', $5)`,
    [tenantId, leadId, eventId, scheduledAt, channel],
  );
}

export async function resetLead(tenantId: number, waId: string) {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  const id = rows[0]?.id;
  if (id) {
    await pool.query(`DELETE FROM messages WHERE lead_id = $1`, [id]);
    await pool.query(`DELETE FROM appointments WHERE lead_id = $1`, [id]);
  }
  await pool.query(`DELETE FROM leads WHERE tenant_id = $1 AND wa_id = $2`, [tenantId, waId]);
}
