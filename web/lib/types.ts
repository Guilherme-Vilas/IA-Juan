// Mirror dos tipos de /src/core/db.ts — mantenha em sincronia.
// (Idealmente, extrair pra /packages/shared no futuro.)

export type Tenant = {
  id: number;
  slug: string;
  name: string;
  evolution_instance: string;
  owner_name: string;
  active: boolean;
};

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
  profissao?: string;
  renda_aproximada?: string;
  modelo_carro?: string;
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
  // facilita / apolar
  entrada_disponivel?: number;
  usa_fgts?: boolean;
  finalidade?: "moradia" | "investimento" | "renda_locacao";
  tipo_imovel?: "lancamento" | "usado" | "comercial";
  regiao_interesse?: string;
  pretende_financiar?: boolean;
  ja_visitou_imovel?: boolean;
};

export type Lead = {
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

// ===== Prospect =====
export type Channel = "whatsapp" | "linkedin";
export type CampaignStatus = "draft" | "running" | "paused" | "done";
export type ProspectStatus =
  | "pending"
  | "queued"
  | "sent"
  | "replied"
  | "failed"
  | "skipped"
  | "ready_for_manual";

export type Campaign = {
  id: number;
  name: string;
  channel: Channel;
  template_text: string;
  ai_refine: boolean;
  tone: string;
  status: CampaignStatus;
  rate_per_day: number;
  work_hours_only: boolean;
  created_at: string;
  updated_at: string;
};

export type Prospect = {
  id: number;
  campaign_id: number;
  external_id: string;
  nome: string | null;
  empresa: string | null;
  cargo: string | null;
  raw_csv: Record<string, unknown>;
  composed_message: string | null;
  status: ProspectStatus;
  skip_reason: string | null;
  sent_at: string | null;
  replied_at: string | null;
  lead_id: number | null;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignMetrics = {
  total: number;
  pending: number;
  queued: number;
  sent: number;
  replied: number;
  failed: number;
  skipped: number;
  ready_for_manual: number;
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  running: "Rodando",
  paused: "Pausada",
  done: "Concluída",
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-slate-400",
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  done: "bg-blue-500",
};

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  pending: "Pendente",
  queued: "Na fila",
  sent: "Enviada",
  replied: "Respondeu",
  failed: "Falhou",
  skipped: "Pulado",
  ready_for_manual: "Envio manual",
};

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  queued: "bg-indigo-100 text-indigo-700",
  sent: "bg-blue-100 text-blue-700",
  replied: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-amber-100 text-amber-700",
  ready_for_manual: "bg-violet-100 text-violet-700",
};
