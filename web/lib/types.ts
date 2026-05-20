// Mirror dos tipos de /src/core/db.ts — mantenha em sincronia.
// (Idealmente, extrair pra /packages/shared no futuro.)

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

export type Slots = {
  nome?: string;
  interesse?: "imovel" | "auto" | "investimento" | "outro";
  capacidade_mensal?: number;
  valor_bem?: number;
  prazo_meses?: number;
  intencao_lance?: boolean;
  observacoes?: string;
  sabe_consorcio?: boolean;
  prazo_decisao?: string;
  fecha_se_proposta_boa?: boolean;
  decisao_com_conjuge?: boolean;
  mora_exterior?: boolean;
};

export type Lead = {
  id: number;
  wa_id: string;
  nome: string | null;
  source: string | null;
  state: LeadState;
  slots: Slots;
  paused: boolean;
  status: LeadStatus;
  closed_reason: ClosedReason | null;
  closed_at: string | null;
  last_user_at: string | null;
  last_assistant_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: number;
  lead_id: number;
  direction: "in" | "out";
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type Appointment = {
  id: number;
  lead_id: number;
  calendar_event_id: string;
  scheduled_at: string;
  status: string;
  meeting_channel: "ligacao" | "video" | null;
  created_at: string;
};

export const FSM_STATES: LeadState[] = [
  "S0_ABERTURA",
  "S1_DESCOBERTA",
  "S2_QUALIFICACAO",
  "S3_EDUCACAO",
  "S4_AGENDAMENTO",
  "S5_CONFIRMADO",
  "HANDOFF",
];

export const STATE_LABELS: Record<LeadState, string> = {
  S0_ABERTURA: "Abertura",
  S1_DESCOBERTA: "Descoberta",
  S2_QUALIFICACAO: "Qualificação",
  S3_EDUCACAO: "Educação",
  S4_AGENDAMENTO: "Agendamento",
  S5_CONFIRMADO: "Agendado",
  HANDOFF: "Handoff",
};

export const STATE_COLORS: Record<LeadState, string> = {
  S0_ABERTURA: "bg-slate-500",
  S1_DESCOBERTA: "bg-blue-500",
  S2_QUALIFICACAO: "bg-cyan-600",
  S3_EDUCACAO: "bg-amber-500",
  S4_AGENDAMENTO: "bg-violet-500",
  S5_CONFIRMADO: "bg-emerald-500",
  HANDOFF: "bg-orange-500",
};

export const REASON_LABELS: Record<ClosedReason, string> = {
  scheduled: "Agendado",
  not_interested: "Sem interesse",
  postponed: "Adiado",
  handoff: "Handoff humano",
  no_response: "Sem resposta",
};
