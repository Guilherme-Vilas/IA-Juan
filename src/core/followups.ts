import { pool } from "./db.js";
import { config } from "../config.js";
import type { TenantRow } from "./tenants.js";

// Configuração do follow-up de conversa (lead que parou de responder a IA).
// Sem linha no banco, vale o comportamento padrão — os mesmos 2 toques e tempos
// que antes eram constantes no worker.

export type FollowupStep = { delay_minutes: number; text: string };
export type FollowupConfig = {
  enabled: boolean;
  steps: FollowupStep[];
  close_after_minutes: number;
  work_hours_only: boolean;
};

export const DEFAULT_FOLLOWUP_STEPS: FollowupStep[] = [
  {
    delay_minutes: Math.round(config.FOLLOWUP_1_MS / 60_000),
    text: "Oi! Conseguiu ver a mensagem? Fico no aguardo do seu retorno 🙌",
  },
  {
    delay_minutes: Math.round(config.FOLLOWUP_2_MS / 60_000),
    text: "Oi! Tudo bem? Aproveitando que estou online, conseguimos seguir agora pra eu te apresentar as opções?",
  },
];

const DEFAULTS: FollowupConfig = {
  enabled: true,
  steps: DEFAULT_FOLLOWUP_STEPS,
  close_after_minutes: Math.round(config.FOLLOWUP_CLOSE_MS / 60_000),
  work_hours_only: true,
};

export const MAX_FOLLOWUP_STEPS = 5;

export async function getFollowupConfig(tenantId: number): Promise<FollowupConfig> {
  const { rows } = await pool.query<{
    enabled: boolean;
    steps: FollowupStep[];
    close_after_minutes: number;
    work_hours_only: boolean;
  }>(`SELECT enabled, steps, close_after_minutes, work_hours_only FROM tenant_followups WHERE tenant_id = $1`, [
    tenantId,
  ]);
  const row = rows[0];
  if (!row) return DEFAULTS;
  const steps = Array.isArray(row.steps) && row.steps.length > 0 ? row.steps : DEFAULTS.steps;
  return {
    enabled: row.enabled,
    steps,
    close_after_minutes: row.close_after_minutes || DEFAULTS.close_after_minutes,
    work_hours_only: row.work_hours_only,
  };
}

export function validateFollowupConfig(input: Partial<FollowupConfig>): string | null {
  if (input.steps) {
    if (!Array.isArray(input.steps) || input.steps.length === 0) return "informe ao menos 1 toque";
    if (input.steps.length > MAX_FOLLOWUP_STEPS) return `no máximo ${MAX_FOLLOWUP_STEPS} toques`;
    for (const s of input.steps) {
      if (!s?.text?.trim()) return "todo toque precisa de texto";
      if (s.text.length > 600) return "texto do toque muito longo (máx 600)";
      if (!Number.isFinite(s.delay_minutes) || s.delay_minutes < 5) return "espera mínima entre toques: 5 minutos";
      if (s.delay_minutes > 30 * 24 * 60) return "espera máxima entre toques: 30 dias";
    }
  }
  if (
    input.close_after_minutes != null &&
    (!Number.isFinite(input.close_after_minutes) || input.close_after_minutes < 60)
  ) {
    return "fechamento automático: mínimo 1 hora após o último toque";
  }
  return null;
}

export async function saveFollowupConfig(tenantId: number, input: Partial<FollowupConfig>): Promise<void> {
  const cur = await getFollowupConfig(tenantId);
  const next: FollowupConfig = {
    enabled: input.enabled ?? cur.enabled,
    steps: input.steps ?? cur.steps,
    close_after_minutes: input.close_after_minutes ?? cur.close_after_minutes,
    work_hours_only: input.work_hours_only ?? cur.work_hours_only,
  };
  await pool.query(
    `INSERT INTO tenant_followups (tenant_id, enabled, steps, close_after_minutes, work_hours_only, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       enabled = EXCLUDED.enabled, steps = EXCLUDED.steps,
       close_after_minutes = EXCLUDED.close_after_minutes,
       work_hours_only = EXCLUDED.work_hours_only, updated_at = now()`,
    [tenantId, next.enabled, JSON.stringify(next.steps), next.close_after_minutes, next.work_hours_only],
  );
}

export function renderFollowupText(text: string, lead: { nome: string | null }): string {
  const nome = (lead.nome ?? "").trim();
  const primeiro = nome.split(/\s+/)[0] ?? "";
  return text
    .replace(/\{primeiro_nome\}/gi, primeiro)
    .replace(/\{nome\}/gi, nome)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

// Ms até a próxima janela de trabalho do tenant (work_start_hour..work_end_hour,
// no fuso dele). Dentro da janela → 0.
export function msUntilWorkWindow(tenant: TenantRow, now = new Date()): number {
  let hour: number;
  try {
    hour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tenant.timezone || "America/Sao_Paulo",
        hour: "numeric",
        hour12: false,
      }).format(now),
      10,
    ) % 24;
  } catch {
    hour = now.getHours();
  }
  const start = tenant.work_start_hour ?? 8;
  const end = tenant.work_end_hour ?? 20;
  if (hour >= start && hour < end) return 0;
  const hoursUntil = hour < start ? start - hour : 24 - hour + start;
  // Alinha pro início da hora (aproximação de minutos correntes: +5min de folga).
  return hoursUntil * 3_600_000 - (now.getMinutes() * 60_000) + 5 * 60_000;
}
