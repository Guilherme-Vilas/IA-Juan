import { pool } from "./db.js";
import { logger } from "./logger.js";
import type { LeadState } from "./db.js";

// ===== Fases canonicas (= leads.state). Sao o vocabulario ESTAVEL da IA. =====
// A pipeline da empresa mapeia cada coluna a uma destas fases (trigger_state).
export const CANONICAL_PHASES: Array<{ state: LeadState; label: string }> = [
  { state: "S0_ABERTURA", label: "Novo / abertura" },
  { state: "S1_DESCOBERTA", label: "Descoberta" },
  { state: "S2_QUALIFICACAO", label: "Qualificação" },
  { state: "S3_EDUCACAO", label: "Educação" },
  { state: "S4_AGENDAMENTO", label: "Agendando" },
  { state: "S5_CONFIRMADO", label: "Agendado" },
  { state: "HANDOFF", label: "Atendimento humano" },
];

// Etapas default de uma pipeline nova (1:1 com as fases canonicas).
const DEFAULT_STAGES: Array<{
  name: string;
  position: number;
  color: string;
  trigger_state: LeadState;
}> = [
  { name: "Novo", position: 0, color: "#71717A", trigger_state: "S0_ABERTURA" },
  { name: "Descoberta", position: 1, color: "#60A5FA", trigger_state: "S1_DESCOBERTA" },
  { name: "Qualificação", position: 2, color: "#22D3EE", trigger_state: "S2_QUALIFICACAO" },
  { name: "Educação", position: 3, color: "#FBBF24", trigger_state: "S3_EDUCACAO" },
  { name: "Agendando", position: 4, color: "#C9A876", trigger_state: "S4_AGENDAMENTO" },
  { name: "Agendado", position: 5, color: "#4ADE80", trigger_state: "S5_CONFIRMADO" },
  { name: "Atendimento humano", position: 6, color: "#F87171", trigger_state: "HANDOFF" },
];

export type PipelineStageRow = {
  id: number;
  pipeline_id: number;
  name: string;
  position: number;
  color: string;
  trigger_state: string | null;
  is_won: boolean;
  is_lost: boolean;
  sla_hours: number | null;
  ai_goal: string;
};

export type StageActor = "ai" | "human" | "system";

// Garante que o tenant tem pipeline + etapas. Idempotente.
export async function ensurePipeline(tenantId: number): Promise<number> {
  const existing = await pool.query<{ id: number }>(
    `SELECT id FROM pipelines WHERE tenant_id = $1`,
    [tenantId],
  );
  let pipelineId = existing.rows[0]?.id;
  if (!pipelineId) {
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO pipelines (tenant_id) VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [tenantId],
    );
    pipelineId = ins.rows[0]!.id;
  }
  const hasStages = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM pipeline_stages WHERE pipeline_id = $1`,
    [pipelineId],
  );
  if (Number(hasStages.rows[0]?.n ?? "0") === 0) {
    for (const s of DEFAULT_STAGES) {
      await pool.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, position, color, trigger_state)
         VALUES ($1,$2,$3,$4,$5)`,
        [pipelineId, s.name, s.position, s.color, s.trigger_state],
      );
    }
    logger.info({ tenantId, pipelineId }, "pipeline: default stages seeded");
  }
  return pipelineId;
}

export async function getStages(tenantId: number): Promise<PipelineStageRow[]> {
  await ensurePipeline(tenantId);
  const { rows } = await pool.query<PipelineStageRow>(
    `SELECT ps.* FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.tenant_id = $1
      ORDER BY ps.position ASC, ps.id ASC`,
    [tenantId],
  );
  return rows;
}

// Etapa que a fase canonica alimenta (trigger_state == phase). null se nenhuma mapeia.
export async function stageForState(
  tenantId: number,
  phase: string,
): Promise<PipelineStageRow | null> {
  const { rows } = await pool.query<PipelineStageRow>(
    `SELECT ps.* FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.tenant_id = $1 AND ps.trigger_state = $2
      LIMIT 1`,
    [tenantId, phase],
  );
  return rows[0] ?? null;
}

async function logStageEvent(input: {
  tenantId: number;
  leadId: number;
  fromStageId: number | null;
  toStageId: number | null;
  fromState: string | null;
  toState: string | null;
  actor: StageActor;
  actorUserId?: number | null;
  reason?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO lead_stage_events
       (tenant_id, lead_id, from_stage_id, to_stage_id, from_state, to_state, actor, actor_user_id, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.tenantId,
      input.leadId,
      input.fromStageId,
      input.toStageId,
      input.fromState,
      input.toState,
      input.actor,
      input.actorUserId ?? null,
      input.reason ?? "",
    ],
  );
}

// ===== Reflexo automatico da IA =====
// Recalcula a coluna do lead a partir da fase canonica e move/loga se mudou.
// Respeita o "pin manual": se um humano arrastou o lead (stage_manual=true),
// a IA NAO move a coluna automaticamente (mas a conversa segue normal).
export async function syncLeadStage(
  tenantId: number,
  leadId: number,
  phase: string,
  opts: { actor?: StageActor; actorUserId?: number | null; reason?: string } = {},
): Promise<PipelineStageRow | null> {
  const actor = opts.actor ?? "ai";
  const cur = await pool.query<{
    pipeline_stage_id: number | null;
    stage_manual: boolean;
    state: string;
  }>(`SELECT pipeline_stage_id, stage_manual, state FROM leads WHERE id = $1 AND tenant_id = $2`, [
    leadId,
    tenantId,
  ]);
  const lead = cur.rows[0];
  if (!lead) return null;

  // Lead "fora da automacao" (humano assumiu a coluna): IA nao mexe na coluna.
  if (actor === "ai" && lead.stage_manual) return null;

  const target = await stageForState(tenantId, phase);
  if (!target) return null; // fase sem coluna mapeada -> nao move
  if (target.id === lead.pipeline_stage_id) return target; // ja esta la

  // Reinicia o relogio de etapa (tempo-em-etapa/SLA) e zera o alerta.
  await pool.query(
    `UPDATE leads SET pipeline_stage_id = $1, stage_entered_at = now(), sla_alerted_at = NULL, updated_at = now()
      WHERE id = $2`,
    [target.id, leadId],
  );
  await logStageEvent({
    tenantId,
    leadId,
    fromStageId: lead.pipeline_stage_id,
    toStageId: target.id,
    fromState: lead.state,
    toState: phase,
    actor,
    actorUserId: opts.actorUserId ?? null,
    reason: opts.reason ?? "",
  });
  return target;
}

// ===== Movimento manual (arraste no board) =====
// - Coluna MAPEADA (tem trigger_state): alinha leads.state pra fase da coluna e
//   devolve o lead a automacao (stage_manual=false) -> a IA segue dali.
// - Coluna MANUAL (sem trigger_state): marca stage_manual=true -> IA nao auto-move.
export async function moveLeadManual(
  tenantId: number,
  waId: string,
  toStageId: number,
  opts: { actorUserId?: number | null; reason?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  const leadRes = await pool.query<{ id: number; pipeline_stage_id: number | null; state: string }>(
    `SELECT id, pipeline_stage_id, state FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  const lead = leadRes.rows[0];
  if (!lead) return { ok: false, error: "lead not found" };

  const stageRes = await pool.query<PipelineStageRow>(
    `SELECT ps.* FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
      WHERE p.tenant_id = $1 AND ps.id = $2`,
    [tenantId, toStageId],
  );
  const stage = stageRes.rows[0];
  if (!stage) return { ok: false, error: "stage not found" };

  const mapped = stage.trigger_state != null;
  const terminal = stage.is_won || stage.is_lost;
  // Desfecho comercial: ao cair numa coluna Ganho/Perdido, registra o resultado
  // e pausa a IA (deal fechado nao recebe mais follow-up automatico). Ao voltar
  // pra uma coluna normal, limpa o desfecho (lead reentrou no funil).
  const outcome = stage.is_won ? "won" : stage.is_lost ? "lost" : null;
  await pool.query(
    `UPDATE leads
        SET pipeline_stage_id = $1,
            stage_manual = $2,
            state = COALESCE($3, state),
            stage_entered_at = now(),
            sla_alerted_at = NULL,
            outcome = $4,
            outcome_reason = CASE WHEN $4 IS NULL THEN '' ELSE COALESCE($5,'') END,
            outcome_at = CASE WHEN $4 IS NULL THEN NULL ELSE now() END,
            paused = CASE WHEN $6 THEN true ELSE paused END,
            updated_at = now()
      WHERE id = $7`,
    [
      stage.id,
      !mapped,
      mapped ? stage.trigger_state : null,
      outcome,
      opts.reason ?? null,
      terminal,
      lead.id,
    ],
  );

  await logStageEvent({
    tenantId,
    leadId: lead.id,
    fromStageId: lead.pipeline_stage_id,
    toStageId: stage.id,
    fromState: lead.state,
    toState: mapped ? stage.trigger_state : lead.state,
    actor: "human",
    actorUserId: opts.actorUserId ?? null,
    reason: opts.reason ?? "movido manualmente",
  });
  return { ok: true };
}

// Devolve o lead a automacao: reabilita o sync e reposiciona pela fase atual.
export async function returnLeadToAuto(tenantId: number, waId: string): Promise<boolean> {
  const leadRes = await pool.query<{ id: number; state: string }>(
    `SELECT id, state FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  const lead = leadRes.rows[0];
  if (!lead) return false;
  await pool.query(`UPDATE leads SET stage_manual = false WHERE id = $1`, [lead.id]);
  await syncLeadStage(tenantId, lead.id, lead.state, { actor: "system", reason: "voltou à automação" });
  return true;
}

// ===== Editor de etapas (salva a pipeline inteira) =====
export type StageInput = {
  id?: number;
  name: string;
  color?: string;
  trigger_state?: string | null;
  is_won?: boolean;
  is_lost?: boolean;
  sla_hours?: number | null;
  ai_goal?: string;
};

export async function replaceStages(
  tenantId: number,
  stages: StageInput[],
): Promise<{ ok: boolean; error?: string }> {
  if (!stages.length) return { ok: false, error: "pipeline precisa de ao menos 1 etapa" };

  // Valida mapeamento deterministico: cada fase canonica em no maximo 1 coluna.
  const triggers = stages.map((s) => s.trigger_state).filter((t): t is string => !!t);
  if (new Set(triggers).size !== triggers.length) {
    return { ok: false, error: "cada fase canônica só pode alimentar uma etapa" };
  }
  const validPhases = new Set(CANONICAL_PHASES.map((p) => p.state));
  for (const t of triggers) {
    if (!validPhases.has(t as LeadState)) return { ok: false, error: `fase inválida: ${t}` };
  }

  const pipelineId = await ensurePipeline(tenantId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: number }>(
      `SELECT id FROM pipeline_stages WHERE pipeline_id = $1`,
      [pipelineId],
    );
    const keepIds = new Set<number>();

    // Zera os triggers antes de reaplicar — evita colisao transitoria no indice
    // unico (pipeline_id, trigger_state) durante reordenacao/remapeamento.
    await client.query(`UPDATE pipeline_stages SET trigger_state = NULL WHERE pipeline_id = $1`, [
      pipelineId,
    ]);

    for (let pos = 0; pos < stages.length; pos++) {
      const s = stages[pos]!;
      if (s.id) {
        await client.query(
          `UPDATE pipeline_stages
              SET name = $1, position = $2, color = COALESCE($3,color),
                  trigger_state = $4, is_won = COALESCE($5,is_won), is_lost = COALESCE($6,is_lost),
                  sla_hours = $7, ai_goal = COALESCE($8,ai_goal)
            WHERE id = $9 AND pipeline_id = $10`,
          [
            s.name, pos, s.color ?? null, s.trigger_state ?? null, s.is_won ?? null, s.is_lost ?? null,
            s.sla_hours ?? null, s.ai_goal ?? null, s.id, pipelineId,
          ],
        );
        keepIds.add(s.id);
      } else {
        const ins = await client.query<{ id: number }>(
          `INSERT INTO pipeline_stages (pipeline_id, name, position, color, trigger_state, is_won, is_lost, sla_hours, ai_goal)
           VALUES ($1,$2,$3,COALESCE($4,'#71717A'),$5,COALESCE($6,false),COALESCE($7,false),$8,COALESCE($9,''))
           RETURNING id`,
          [
            pipelineId, s.name, pos, s.color ?? null, s.trigger_state ?? null, s.is_won ?? null, s.is_lost ?? null,
            s.sla_hours ?? null, s.ai_goal ?? null,
          ],
        );
        keepIds.add(ins.rows[0]!.id);
      }
    }

    // Remove etapas que sumiram (FK em leads -> SET NULL).
    const toDelete = existing.rows.map((r) => r.id).filter((id) => !keepIds.has(id));
    if (toDelete.length) {
      await client.query(`DELETE FROM pipeline_stages WHERE id = ANY($1::bigint[])`, [toDelete]);
    }

    // Reposiciona leads orfaos (etapa deletada) pela fase atual, senao 1a coluna.
    await client.query(
      `UPDATE leads l
          SET pipeline_stage_id = COALESCE(
                (SELECT ps.id FROM pipeline_stages ps
                  WHERE ps.pipeline_id = $1 AND ps.trigger_state = l.state LIMIT 1),
                (SELECT ps.id FROM pipeline_stages ps
                  WHERE ps.pipeline_id = $1 ORDER BY ps.position ASC LIMIT 1)
              )
        WHERE l.tenant_id = $2 AND l.pipeline_stage_id IS NULL`,
      [pipelineId, tenantId],
    );

    await client.query(`UPDATE pipelines SET updated_at = now() WHERE id = $1`, [pipelineId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error({ err, tenantId }, "pipeline: replaceStages failed");
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  } finally {
    client.release();
  }
}

// ===== Timeline de transicoes de um lead =====
export type StageEventRow = {
  id: number;
  from_stage_id: number | null;
  to_stage_id: number | null;
  from_state: string | null;
  to_state: string | null;
  actor: StageActor;
  reason: string;
  created_at: Date;
  to_stage_name: string | null;
  from_stage_name: string | null;
};

// Objetivo da IA na etapa ATUAL do lead (a coluna onde ele esta no board).
// Reflete tanto etapas automaticas quanto manuais -> a IA persegue a meta da
// coluna em que a empresa colocou o lead.
export async function getStageGoalForLead(tenantId: number, leadId: number): Promise<string> {
  const { rows } = await pool.query<{ ai_goal: string }>(
    `SELECT ps.ai_goal
       FROM leads l
       JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      WHERE l.id = $1 AND l.tenant_id = $2`,
    [leadId, tenantId],
  );
  return (rows[0]?.ai_goal ?? "").trim();
}

export async function listStageEvents(tenantId: number, waId: string, limit = 50): Promise<StageEventRow[]> {
  const { rows } = await pool.query<StageEventRow>(
    `SELECT e.id, e.from_stage_id, e.to_stage_id, e.from_state, e.to_state, e.actor, e.reason, e.created_at,
            ts.name AS to_stage_name, fs.name AS from_stage_name
       FROM lead_stage_events e
       JOIN leads l ON l.id = e.lead_id
       LEFT JOIN pipeline_stages ts ON ts.id = e.to_stage_id
       LEFT JOIN pipeline_stages fs ON fs.id = e.from_stage_id
      WHERE e.tenant_id = $1 AND l.wa_id = $2
      ORDER BY e.created_at DESC
      LIMIT $3`,
    [tenantId, waId, limit],
  );
  return rows;
}
