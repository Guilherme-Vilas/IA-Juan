import { pool } from "./db.js";
import { logger } from "./logger.js";
import { sendText } from "./evolution.js";
import { getTenantById, type TenantRow } from "./tenants.js";
import { isWhatsappConnected } from "./connection-monitor.js";

// Ciclo de vida da reunião. Comparecimento é onde a venda acontece — então:
// 1) lembrete pro LEAD 24h e 1h antes (com pedido de confirmação);
// 2) cutucada pro DONO depois do horário: "aconteceu? marca o resultado";
// 3) status de verdade (confirmed/completed/no_show/cancelled) com efeitos:
//    no_show/cancelled reabrem a conversa e voltam o lead pra S4 (remarcar).

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled";

type ReminderRow = {
  id: number;
  tenant_id: number;
  lead_id: number;
  wa_id: string;
  nome: string | null;
  scheduled_at: Date;
  meeting_channel: "ligacao" | "video" | null;
};

function fmtHour(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone || "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  }
}

function channelLabel(c: "ligacao" | "video" | null): string {
  return c === "video" ? "por vídeo chamada" : "por ligação";
}

const firstName = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || null;

// ===== Lembretes pro lead =====
// 24h: só pra reunião marcada com pelo menos 20h de antecedência (senão o toque
// de 1h cobre) e criada há mais de 1h (pra não colar na confirmação).
async function reminderCandidates(kind: "24h" | "1h", limit = 50): Promise<ReminderRow[]> {
  const windowSql =
    kind === "24h"
      ? `a.scheduled_at BETWEEN now() + interval '20 hours' AND now() + interval '24 hours'
         AND a.reminder_24h_sent_at IS NULL
         AND a.created_at < now() - interval '1 hour'`
      : `a.scheduled_at BETWEEN now() AND now() + interval '1 hour'
         AND a.reminder_1h_sent_at IS NULL
         AND a.created_at < now() - interval '30 minutes'`;
  const { rows } = await pool.query<ReminderRow>(
    `SELECT a.id, a.tenant_id, a.lead_id, l.wa_id, l.nome, a.scheduled_at, a.meeting_channel
       FROM appointments a
       JOIN leads l ON l.id = a.lead_id
      WHERE a.status IN ('scheduled','confirmed')
        AND ${windowSql}
      ORDER BY a.scheduled_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function scanAppointmentReminders(): Promise<void> {
  const tenantsCache = new Map<number, TenantRow | null>();
  const tenantOf = async (id: number) => {
    if (!tenantsCache.has(id)) tenantsCache.set(id, await getTenantById(id).catch(() => null));
    return tenantsCache.get(id) ?? null;
  };

  for (const kind of ["24h", "1h"] as const) {
    const rows = await reminderCandidates(kind).catch((err) => {
      logger.error({ err, kind }, "lembrete de reunião: query falhou");
      return [] as ReminderRow[];
    });
    for (const r of rows) {
      const tenant = await tenantOf(r.tenant_id);
      if (!tenant?.active) continue;
      if (!(await isWhatsappConnected(tenant))) continue; // chip caído: tenta no próximo tick
      const hora = fmtHour(new Date(r.scheduled_at), tenant.timezone);
      const nome = firstName(r.nome);
      const text =
        kind === "24h"
          ? `Oi${nome ? ` ${nome}` : ""}! Passando pra lembrar: sua conversa com ${tenant.owner_name} é amanhã às ${hora}, ${channelLabel(r.meeting_channel)}. 📅\n\nTá confirmado pra você? Se precisar remarcar, é só me avisar por aqui.`
          : `Oi${nome ? ` ${nome}` : ""}! Daqui a pouco, às ${hora}, é sua conversa com ${tenant.owner_name}, ${channelLabel(r.meeting_channel)}. 🙂\n\nQualquer imprevisto, me chama aqui que a gente remarca.`;
      try {
        await sendText(tenant, r.wa_id, text);
        const col = kind === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";
        await pool.query(`UPDATE appointments SET ${col} = now() WHERE id = $1`, [r.id]);
        logger.info({ tenant: tenant.slug, waId: r.wa_id, kind, appointmentId: r.id }, "lembrete de reunião enviado");
      } catch (err) {
        logger.error({ err, appointmentId: r.id, kind }, "lembrete de reunião falhou");
      }
    }
  }

  await scanOwnerNudges(tenantOf).catch((err) => logger.error({ err }, "cutucada pós-reunião falhou"));
}

// ===== Cutucada pós-reunião pro dono =====
// 1h depois do fim previsto, se ninguém marcou o desfecho, pergunta ao dono.
async function scanOwnerNudges(tenantOf: (id: number) => Promise<TenantRow | null>, limit = 30): Promise<void> {
  const { rows } = await pool.query<ReminderRow & { ends_at: Date | null }>(
    `SELECT a.id, a.tenant_id, a.lead_id, l.wa_id, l.nome, a.scheduled_at, a.meeting_channel, a.ends_at
       FROM appointments a
       JOIN leads l ON l.id = a.lead_id
      WHERE a.status IN ('scheduled','confirmed')
        AND a.owner_nudge_sent_at IS NULL
        AND COALESCE(a.ends_at, a.scheduled_at + interval '30 minutes') < now() - interval '1 hour'
        AND a.scheduled_at > now() - interval '3 days'
      ORDER BY a.scheduled_at ASC
      LIMIT $1`,
    [limit],
  );
  for (const r of rows) {
    const tenant = await tenantOf(r.tenant_id);
    if (!tenant?.active || !tenant.owner_whatsapp_e164) continue;
    const who = r.nome || r.wa_id;
    const hora = fmtHour(new Date(r.scheduled_at), tenant.timezone);
    try {
      await sendText(
        tenant,
        tenant.owner_whatsapp_e164,
        `📋 A reunião com *${who}* era às ${hora}. Como foi?\n\nMarca no painel (Agenda): _Realizada_ ou _Não compareceu_ — assim o funil fica certo e, no caso de falta, dá pra reengajar.`,
      );
      await pool.query(`UPDATE appointments SET owner_nudge_sent_at = now() WHERE id = $1`, [r.id]);
    } catch (err) {
      logger.error({ err, appointmentId: r.id }, "cutucada pós-reunião: envio falhou");
    }
  }
}

// ===== Mudança de status =====
const VALID: AppointmentStatus[] = ["scheduled", "confirmed", "completed", "no_show", "cancelled"];

export async function setAppointmentStatus(
  tenantId: number,
  appointmentId: number,
  status: AppointmentStatus,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID.includes(status)) return { ok: false, error: "status inválido" };
  const { rows } = await pool.query<{ id: number; lead_id: number; wa_id: string }>(
    `UPDATE appointments a
        SET status = $1,
            status_changed_at = now(),
            confirmed_at = CASE WHEN $1 = 'confirmed' THEN now() ELSE a.confirmed_at END,
            outcome_note = COALESCE($2, a.outcome_note)
       FROM leads l
      WHERE a.id = $3 AND a.tenant_id = $4 AND l.id = a.lead_id
      RETURNING a.id, a.lead_id, l.wa_id`,
    [status, note ?? null, appointmentId, tenantId],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "appointment not found" };

  // Falta ou cancelamento: a venda não morreu — reabre a conversa, volta o lead
  // pra fase de agendamento e dispara automação pro dono configurar o resgate.
  if (status === "no_show" || status === "cancelled") {
    await pool.query(
      `UPDATE leads SET status = 'open', closed_reason = NULL, closed_at = NULL,
              state = 'S4_AGENDAMENTO', updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [row.lead_id, tenantId],
    ).catch(() => undefined);
    try {
      const { syncLeadStage } = await import("./pipeline.js");
      await syncLeadStage(tenantId, row.lead_id, "S4_AGENDAMENTO", {
        actor: "system",
        reason: status === "no_show" ? "não compareceu à reunião" : "reunião cancelada",
      });
    } catch (err) {
      logger.warn({ err, leadId: row.lead_id }, "no-show: sync pipeline falhou");
    }
    try {
      const { fireTrigger } = await import("./automations.js");
      await fireTrigger(tenantId, "appointment_no_show", row.lead_id, {});
    } catch (err) {
      logger.warn({ err, leadId: row.lead_id }, "no-show: trigger falhou");
    }
    try {
      const { emitEvent } = await import("./outbound-webhooks.js");
      await emitEvent(tenantId, "appointment.no_show", { lead_id: row.lead_id, wa_id: row.wa_id, status });
    } catch {
      /* best-effort */
    }
  }
  logger.info({ tenantId, appointmentId, status }, "appointment: status atualizado");
  return { ok: true };
}
