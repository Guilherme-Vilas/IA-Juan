// Mirror dos tipos de /src/core/db.ts — mantenha em sincronia.
// (Idealmente, extrair pra /packages/shared no futuro.)

export type Tenant = {
  id: number;
  slug: string;
  name: string;
  evolution_instance: string;
  owner_name: string;
  playbook_slug: string | null;
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
  score: number;
  score_label: "frio" | "morno" | "quente" | "pronto";
  score_reasons: string[];
  paused: boolean;
  status: LeadStatus;
  closed_reason: ClosedReason | null;
  closed_at: string | null;
  last_user_at: string | null;
  last_assistant_at: string | null;
  created_at: string;
  updated_at: string;
  // CRM / pipeline configuravel
  pipeline_stage_id: number | null;
  stage_manual: boolean;
  // Fase 2: desfecho + relogio de etapa
  outcome: "won" | "lost" | null;
  outcome_reason: string;
  outcome_at: string | null;
  stage_entered_at: string;
  // CRM Lote 1: valor do negocio + vendedor responsavel
  value_cents: number | null;
  assigned_user_id: number | null;
  // CRM Lote 2: campos customizados (keyed por def.key)
  custom_fields: Record<string, unknown>;
  // CRM Lote 3: detalhe da origem (utm, anuncio, etc.)
  source_detail: Record<string, unknown>;
};

export type TenantMember = {
  user_id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "sdr" | "viewer";
};

export type CustomFieldType = "text" | "number" | "select" | "date" | "boolean";
export type CustomFieldDef = {
  id: number;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  position: number;
};

export type LeadTask = {
  id: number;
  title: string;
  assigned_user_id: number | null;
  assignee: string | null;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
};

// ===== Automacoes / cadencias =====
export type AutomationTrigger = "lead_created" | "stage_entered" | "lead_won" | "lead_lost" | "no_reply";
export type AutomationActionType =
  | "send_message"
  | "create_task"
  | "add_note"
  | "assign_round_robin"
  | "move_stage"
  | "notify_owner";
export type AutomationStep = {
  delay_minutes: number;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
};
export type Automation = {
  id: number;
  name: string;
  enabled: boolean;
  trigger_type: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  stop_on_reply: boolean;
  steps: number; // contagem na listagem
};
export type AutomationFull = Omit<Automation, "steps"> & { steps: AutomationStep[] };

// ===== Lote 4 — catalogo de imoveis =====
export type Property = {
  id: number;
  tenant_id: number;
  ref: string;
  title: string;
  description: string;
  transaction: "venda" | "locacao";
  type: string;
  status: "disponivel" | "reservado" | "vendido" | "inativo";
  price_cents: number | null;
  condo_cents: number | null;
  iptu_cents: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  parking: number | null;
  area_m2: number | null;
  neighborhood: string;
  city: string;
  state: string;
  address: string;
  features: string[];
  photos: string[];
  created_at: string;
  updated_at: string;
};

export type LeadNote = {
  id: number;
  body: string;
  user_id: number | null;
  author: string | null;
  created_at: string;
};

// ===== Pipeline configuravel (CRM) =====
export type PipelineStage = {
  id: number;
  pipeline_id: number;
  name: string;
  position: number;
  color: string; // hex (#RRGGBB)
  trigger_state: LeadState | null; // null = etapa manual (IA nao move)
  is_won: boolean;
  is_lost: boolean;
  sla_hours: number | null; // horas ate "esfriar" (null = sem SLA)
  ai_goal: string; // objetivo que a IA persegue nesta etapa
};

export type CanonicalPhase = { state: LeadState; label: string };

// Fases canonicas da IA (espelha src/core/pipeline.ts). Cada etapa da pipeline
// mapeia pra no maximo uma destas (trigger_state). null = etapa manual.
export const PIPELINE_PHASES: CanonicalPhase[] = [
  { state: "S0_ABERTURA", label: "Novo / abertura" },
  { state: "S1_DESCOBERTA", label: "Descoberta" },
  { state: "S2_QUALIFICACAO", label: "Qualificação" },
  { state: "S3_EDUCACAO", label: "Educação" },
  { state: "S4_AGENDAMENTO", label: "Agendando" },
  { state: "S5_CONFIRMADO", label: "Agendado" },
  { state: "HANDOFF", label: "Atendimento humano" },
];

export type StageEvent = {
  id: number;
  from_stage_id: number | null;
  to_stage_id: number | null;
  from_state: string | null;
  to_state: string | null;
  actor: "ai" | "human" | "system";
  reason: string;
  created_at: string;
  to_stage_name: string | null;
  from_stage_name: string | null;
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
  ends_at: string;
  calendar_provider: "internal" | "google";
  status: string;
  meeting_channel: "ligacao" | "video" | null;
  created_at: string;
};

export type WorkingHour = {
  id: number;
  tenant_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type CalendarBlock = {
  id: number;
  tenant_id: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
};

export type AgentSettings = {
  tenant_id: number;
  agent_name: string;
  tone: string;
  products: string[];
  regions: string[];
  qualification_rules: string;
  handoff_rules: string;
  updated_at: string;
};

export type PlaybookTemplate = {
  id: number;
  slug: string;
  name: string;
  segment: string;
  description: string;
  default_products: string[];
  default_rules: string;
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
