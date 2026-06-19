import { pool } from "./db.js";
import { logger } from "./logger.js";
import { config } from "../config.js";
import { redis, keys } from "./redis.js";
import { getTenantById, type TenantRow } from "./tenants.js";
import { sendText } from "./evolution.js";
import { logMessage, markLastActivity } from "./db.js";
import { createTask } from "./tasks.js";
import { addNote, assignLead, pickNextAssignee } from "./crm.js";
import { setLeadStageDirect } from "./pipeline.js";

export type TriggerType = "lead_created" | "stage_entered" | "lead_won" | "lead_lost" | "no_reply";
export type ActionType =
  | "send_message"
  | "create_task"
  | "add_note"
  | "assign_round_robin"
  | "move_stage"
  | "notify_owner";

export type AutomationStep = {
  id?: number;
  position: number;
  delay_minutes: number;
  action_type: ActionType;
  action_config: Record<string, unknown>;
};

export type AutomationRow = {
  id: number;
  tenant_id: number;
  name: string;
  enabled: boolean;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  stop_on_reply: boolean;
  created_at: Date;
  updated_at: Date;
};

type LeadLite = {
  id: number;
  wa_id: string;
  nome: string | null;
  score: number;
  source: string | null;
  pipeline_stage_id: number | null;
};

// ===== CRUD =====
export async function listAutomations(
  tenantId: number,
): Promise<Array<AutomationRow & { steps: number }>> {
  const { rows } = await pool.query<AutomationRow & { steps: string }>(
    `SELECT a.*, (SELECT count(*) FROM automation_steps s WHERE s.automation_id = a.id)::text AS steps
       FROM automations a WHERE a.tenant_id = $1 ORDER BY a.created_at DESC`,
    [tenantId],
  );
  return rows.map((r) => ({ ...r, steps: Number(r.steps) }));
}

export async function getAutomation(
  tenantId: number,
  id: number,
): Promise<(AutomationRow & { steps: AutomationStep[] }) | null> {
  const a = await pool.query<AutomationRow>(`SELECT * FROM automations WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  if (!a.rows[0]) return null;
  const steps = await loadSteps(id);
  return { ...a.rows[0], steps };
}

async function loadSteps(automationId: number): Promise<AutomationStep[]> {
  const { rows } = await pool.query<AutomationStep>(
    `SELECT id, position, delay_minutes, action_type, action_config
       FROM automation_steps WHERE automation_id = $1 ORDER BY position ASC`,
    [automationId],
  );
  return rows;
}

export type AutomationInput = {
  name: string;
  enabled?: boolean;
  trigger_type: TriggerType;
  trigger_config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  stop_on_reply?: boolean;
  steps?: Array<{ delay_minutes?: number; action_type: ActionType; action_config?: Record<string, unknown> }>;
};

async function writeSteps(client: typeof pool, automationId: number, steps: AutomationInput["steps"]) {
  await client.query(`DELETE FROM automation_steps WHERE automation_id = $1`, [automationId]);
  let pos = 0;
  for (const s of steps ?? []) {
    await client.query(
      `INSERT INTO automation_steps (automation_id, position, delay_minutes, action_type, action_config)
       VALUES ($1,$2,$3,$4,$5)`,
      [automationId, pos++, Math.max(0, Math.round(s.delay_minutes ?? 0)), s.action_type, JSON.stringify(s.action_config ?? {})],
    );
  }
}

export async function createAutomation(tenantId: number, input: AutomationInput): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO automations (tenant_id, name, enabled, trigger_type, trigger_config, conditions, stop_on_reply)
     VALUES ($1,$2,COALESCE($3,true),$4,$5,$6,COALESCE($7,true)) RETURNING id`,
    [
      tenantId,
      input.name,
      input.enabled ?? null,
      input.trigger_type,
      JSON.stringify(input.trigger_config ?? {}),
      JSON.stringify(input.conditions ?? {}),
      input.stop_on_reply ?? null,
    ],
  );
  const id = rows[0]!.id;
  await writeSteps(pool, id, input.steps);
  return id;
}

export async function updateAutomation(tenantId: number, id: number, input: AutomationInput): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE automations SET name=$1, enabled=COALESCE($2,enabled), trigger_type=$3,
            trigger_config=$4, conditions=$5, stop_on_reply=COALESCE($6,stop_on_reply), updated_at=now()
      WHERE id=$7 AND tenant_id=$8`,
    [
      input.name,
      input.enabled ?? null,
      input.trigger_type,
      JSON.stringify(input.trigger_config ?? {}),
      JSON.stringify(input.conditions ?? {}),
      input.stop_on_reply ?? null,
      id,
      tenantId,
    ],
  );
  if (!rowCount) return false;
  await writeSteps(pool, id, input.steps);
  return true;
}

export async function setAutomationEnabled(tenantId: number, id: number, enabled: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE automations SET enabled=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3`,
    [enabled, id, tenantId],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteAutomation(tenantId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM automations WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
  return (rowCount ?? 0) > 0;
}

// ===== Disparo de gatilho =====
async function loadLead(leadId: number): Promise<LeadLite | null> {
  const { rows } = await pool.query<LeadLite>(
    `SELECT id, wa_id, nome, score, source, pipeline_stage_id FROM leads WHERE id = $1`,
    [leadId],
  );
  return rows[0] ?? null;
}

function conditionsMatch(lead: LeadLite, cond: Record<string, unknown>): boolean {
  if (cond.stage_id && Number(cond.stage_id) !== Number(lead.pipeline_stage_id)) return false;
  if (cond.min_score != null && lead.score < Number(cond.min_score)) return false;
  if (cond.source_contains) {
    const s = String(cond.source_contains).toLowerCase();
    if (!(lead.source ?? "").toLowerCase().includes(s)) return false;
  }
  return true;
}

export async function fireTrigger(
  tenantId: number,
  trigger: TriggerType,
  leadId: number,
  ctx: { stage_id?: number } = {},
): Promise<void> {
  const autos = await pool.query<AutomationRow>(
    `SELECT * FROM automations WHERE tenant_id=$1 AND enabled=true AND trigger_type=$2`,
    [tenantId, trigger],
  );
  if (!autos.rows.length) return;
  const lead = await loadLead(leadId);
  if (!lead) return;
  for (const a of autos.rows) {
    if (trigger === "stage_entered") {
      const want = a.trigger_config?.stage_id;
      if (want && Number(want) !== Number(ctx.stage_id)) continue;
    }
    if (!conditionsMatch(lead, a.conditions)) continue;
    await startRun(a, lead).catch((err) => logger.error({ err, autoId: a.id }, "automation: start failed"));
  }
}

async function startRun(automation: AutomationRow, lead: LeadLite): Promise<void> {
  const steps = await loadSteps(automation.id);
  if (!steps.length) return;
  const delay = steps[0]!.delay_minutes ?? 0;
  const nextAt = new Date(Date.now() + delay * 60_000).toISOString();
  await pool.query(
    `INSERT INTO automation_runs (tenant_id, automation_id, lead_id, current_step, next_run_at)
     VALUES ($1,$2,$3,0,$4)
     ON CONFLICT (automation_id, lead_id) WHERE status='active' DO NOTHING`,
    [automation.tenant_id, automation.id, lead.id, nextAt],
  );
}

// Cancela cadencias quando o lead engaja (stop_on_reply) ou some o motivo (won/lost).
export async function cancelRunsForLead(
  tenantId: number,
  leadId: number,
  opts: { onlyStopOnReply?: boolean } = {},
): Promise<void> {
  if (opts.onlyStopOnReply) {
    await pool.query(
      `UPDATE automation_runs r SET status='cancelled'
         FROM automations a
        WHERE r.automation_id=a.id AND r.lead_id=$1 AND r.tenant_id=$2
          AND r.status='active' AND a.stop_on_reply=true`,
      [leadId, tenantId],
    );
  } else {
    await pool.query(
      `UPDATE automation_runs SET status='cancelled' WHERE lead_id=$1 AND tenant_id=$2 AND status='active'`,
      [leadId, tenantId],
    );
  }
}

// ===== Execucao (tick) =====
function renderTemplate(text: string, lead: LeadLite): string {
  const nome = (lead.nome ?? "").trim();
  const primeiro = nome.split(/\s+/)[0] ?? "";
  return text.replace(/\{primeiro_nome\}/gi, primeiro).replace(/\{nome\}/gi, nome);
}

// Hora local do tenant (evita disparar mensagem de madrugada).
function tenantHour(tenant: TenantRow): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: tenant.timezone || "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    return parseInt(h, 10) % 24;
  } catch {
    return 12;
  }
}
const SEND_START = 8;
const SEND_END = 21;
function isWithinSendWindow(tenant: TenantRow): boolean {
  const h = tenantHour(tenant);
  return h >= SEND_START && h < SEND_END;
}
function deferToMorning(tenant: TenantRow): string {
  const h = tenantHour(tenant);
  const hoursUntil = h < SEND_START ? SEND_START - h : 24 - h + SEND_START;
  return new Date(Date.now() + hoursUntil * 3_600_000).toISOString();
}

async function appendAssistantHistory(tenantSlug: string, waId: string, text: string): Promise<void> {
  const k = keys.leadHistory(tenantSlug, waId);
  await redis.rpush(k, JSON.stringify({ role: "assistant", content: text }));
  await redis.ltrim(k, -10, -1);
  await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
}

async function executeAction(
  tenant: TenantRow,
  lead: LeadLite,
  type: ActionType,
  cfg: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case "send_message": {
      const text = renderTemplate(String(cfg.text ?? ""), lead).trim();
      if (!text) return;
      await sendText(tenant, lead.wa_id, text);
      await logMessage(lead.id, "out", "assistant", text);
      await markLastActivity(tenant.id, lead.wa_id, "assistant");
      await appendAssistantHistory(tenant.slug, lead.wa_id, text);
      break;
    }
    case "create_task": {
      const hours = Number(cfg.due_in_hours);
      const due = hours > 0 ? new Date(Date.now() + hours * 3_600_000).toISOString() : null;
      await createTask(tenant.id, lead.wa_id, { title: String(cfg.title ?? "Tarefa"), due_at: due });
      break;
    }
    case "add_note":
      await addNote(tenant.id, lead.wa_id, null, String(cfg.body ?? ""));
      break;
    case "assign_round_robin": {
      const uid = await pickNextAssignee(tenant.id);
      if (uid != null) await assignLead(tenant.id, lead.wa_id, uid);
      break;
    }
    case "move_stage":
      if (cfg.stage_id) await setLeadStageDirect(tenant.id, lead.id, Number(cfg.stage_id));
      break;
    case "notify_owner":
      if (tenant.owner_whatsapp_e164) {
        await sendText(tenant, tenant.owner_whatsapp_e164, renderTemplate(String(cfg.text ?? ""), lead));
      }
      break;
  }
}

async function finishRun(id: number, status: "done" | "cancelled" = "done"): Promise<void> {
  await pool.query(`UPDATE automation_runs SET status=$1 WHERE id=$2`, [status, id]);
}

// Processa execucoes vencidas (chamado no prospect-tick).
export async function advanceRuns(limit = 50): Promise<number> {
  const { rows } = await pool.query<{
    id: number;
    tenant_id: number;
    automation_id: number;
    lead_id: number;
    current_step: number;
  }>(
    `SELECT id, tenant_id, automation_id, lead_id, current_step
       FROM automation_runs WHERE status='active' AND next_run_at <= now()
      ORDER BY next_run_at ASC LIMIT $1`,
    [limit],
  );
  let executed = 0;
  for (const run of rows) {
    try {
      const steps = await loadSteps(run.automation_id);
      const step = steps[run.current_step];
      if (!step) {
        await finishRun(run.id);
        continue;
      }
      const [tenant, lead] = await Promise.all([getTenantById(run.tenant_id), loadLead(run.lead_id)]);
      if (!tenant || !lead) {
        await finishRun(run.id);
        continue;
      }
      // Nao manda mensagem de madrugada — reagenda pra manha.
      if (step.action_type === "send_message" && !isWithinSendWindow(tenant)) {
        await pool.query(`UPDATE automation_runs SET next_run_at=$1 WHERE id=$2`, [deferToMorning(tenant), run.id]);
        continue;
      }
      await executeAction(tenant, lead, step.action_type, step.action_config);
      executed++;
      const nextIdx = run.current_step + 1;
      const next = steps[nextIdx];
      if (!next) {
        await finishRun(run.id);
      } else {
        const nextAt = new Date(Date.now() + (next.delay_minutes ?? 0) * 60_000).toISOString();
        await pool.query(`UPDATE automation_runs SET current_step=$1, next_run_at=$2 WHERE id=$3`, [
          nextIdx,
          nextAt,
          run.id,
        ]);
      }
    } catch (err) {
      logger.error({ err, runId: run.id }, "automation: run step failed");
      await finishRun(run.id).catch(() => undefined);
    }
  }
  if (executed) logger.info({ executed }, "automations: steps executed");
  return executed;
}

// Gatilho no_reply: inicia a cadencia 1x por lead quando ele fica sem responder.
export async function scanNoReplyAutomations(limit = 50): Promise<number> {
  const autos = await pool.query<AutomationRow>(
    `SELECT * FROM automations WHERE enabled=true AND trigger_type='no_reply'`,
  );
  let started = 0;
  for (const a of autos.rows) {
    const hours = Number(a.trigger_config?.hours ?? 24);
    const { rows: leads } = await pool.query<LeadLite>(
      `SELECT l.id, l.wa_id, l.nome, l.score, l.source, l.pipeline_stage_id
         FROM leads l
        WHERE l.tenant_id = $1 AND l.status='open' AND l.paused=false
          AND l.last_user_at IS NOT NULL
          AND l.last_user_at <= now() - ($2 || ' hours')::interval
          AND NOT EXISTS (SELECT 1 FROM automation_runs r WHERE r.automation_id=$3 AND r.lead_id=l.id)
        LIMIT $4`,
      [a.tenant_id, String(hours), a.id, limit],
    );
    for (const lead of leads) {
      if (!conditionsMatch(lead, a.conditions)) continue;
      await startRun(a, lead).catch(() => undefined);
      started++;
    }
  }
  if (started) logger.info({ started }, "automations: no_reply cadences started");
  return started;
}
