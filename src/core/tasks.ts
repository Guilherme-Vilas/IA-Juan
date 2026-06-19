import { pool } from "./db.js";
import { logger } from "./logger.js";
import { getTenantById } from "./tenants.js";
import { sendText } from "./evolution.js";

export type LeadTask = {
  id: number;
  title: string;
  assigned_user_id: number | null;
  assignee: string | null;
  due_at: Date | null;
  done_at: Date | null;
  created_at: Date;
};

export async function createTask(
  tenantId: number,
  waId: string,
  input: { title: string; due_at?: string | null; assigned_user_id?: number | null; created_by?: number | null },
): Promise<{ ok: boolean; error?: string }> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "título obrigatório" };
  const lead = await pool.query<{ id: number; assigned_user_id: number | null }>(
    `SELECT id, assigned_user_id FROM leads WHERE tenant_id = $1 AND wa_id = $2`,
    [tenantId, waId],
  );
  if (!lead.rows[0]) return { ok: false, error: "lead not found" };
  // por padrao a tarefa vai pro responsavel do lead.
  const assignee = input.assigned_user_id ?? lead.rows[0].assigned_user_id ?? null;
  await pool.query(
    `INSERT INTO lead_tasks (tenant_id, lead_id, title, assigned_user_id, due_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, lead.rows[0].id, title, assignee, input.due_at ?? null, input.created_by ?? null],
  );
  return { ok: true };
}

export async function listTasks(tenantId: number, waId: string): Promise<LeadTask[]> {
  const { rows } = await pool.query<LeadTask>(
    `SELECT t.id, t.title, t.assigned_user_id, u.name AS assignee, t.due_at, t.done_at, t.created_at
       FROM lead_tasks t
       JOIN leads l ON l.id = t.lead_id
       LEFT JOIN users u ON u.id = t.assigned_user_id
      WHERE t.tenant_id = $1 AND l.wa_id = $2
      ORDER BY t.done_at IS NOT NULL, t.due_at ASC NULLS LAST, t.created_at DESC`,
    [tenantId, waId],
  );
  return rows;
}

export async function setTaskDone(tenantId: number, taskId: number, done: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE lead_tasks SET done_at = ${done ? "now()" : "NULL"} WHERE id = $1 AND tenant_id = $2`,
    [taskId, tenantId],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteTask(tenantId: number, taskId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM lead_tasks WHERE id = $1 AND tenant_id = $2`, [
    taskId,
    tenantId,
  ]);
  return (rowCount ?? 0) > 0;
}

// Varre tarefas vencidas ainda nao lembradas e notifica o dono via WhatsApp.
// Roda no prospect-tick (ver workers/prospect.worker.ts).
export async function scanTaskReminders(limit = 50): Promise<number> {
  const { rows } = await pool.query<{
    id: number;
    tenant_id: number;
    title: string;
    wa_id: string;
    nome: string | null;
  }>(
    `SELECT t.id, t.tenant_id, t.title, l.wa_id, l.nome
       FROM lead_tasks t
       JOIN leads l ON l.id = t.lead_id
      WHERE t.done_at IS NULL
        AND t.reminded_at IS NULL
        AND t.due_at IS NOT NULL
        AND t.due_at <= now()
      ORDER BY t.due_at ASC
      LIMIT $1`,
    [limit],
  );
  let notified = 0;
  for (const r of rows) {
    const tenant = await getTenantById(r.tenant_id);
    if (!tenant?.owner_whatsapp_e164) continue;
    const who = r.nome || r.wa_id;
    const text = `🔔 Tarefa vencida: *${r.title}* (lead ${who}).`;
    try {
      await sendText(tenant, tenant.owner_whatsapp_e164, text);
      await pool.query(`UPDATE lead_tasks SET reminded_at = now() WHERE id = $1`, [r.id]);
      notified++;
    } catch (err) {
      logger.error({ err, taskId: r.id }, "tasks: reminder failed");
    }
  }
  if (notified) logger.info({ notified }, "tasks: reminders sent");
  return notified;
}
