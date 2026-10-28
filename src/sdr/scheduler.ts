import { redis, keys } from "../core/redis.js";
import { listFreeSlots, createEvent, deleteEvent, isIntervalFree, type Slot } from "../core/calendar.js";
import { pool, recordAppointment, type LeadRow, type MeetingChannel } from "../core/db.js";
import { buildOffer, type SlotPreference } from "./slot-pick.js";
import { notifyScheduled } from "./handoff.js";
import { logger } from "../core/logger.js";
import type { TenantRow } from "../core/tenants.js";

const OFFER_TTL = 60 * 60 * 2; // 2h

// Busca horários e monta a oferta. `pref` = dia/período que o LEAD pediu —
// com preferência, a oferta respeita; sem horário no dia, devolve alternativas
// e sinaliza (prefUnavailable) pra IA ser honesta em vez de chutar.
export async function fetchAndCacheSlots(
  tenant: TenantRow,
  waId: string,
  pref: SlotPreference | null = null,
): Promise<{ slots: Slot[]; prefUnavailable: boolean }> {
  // Janela de 10 dias / até 24 candidatos: matéria-prima suficiente pra
  // diversificar por dia (a oferta antiga pegava os 3 primeiros → mesmo dia).
  const all = await listFreeSlots(tenant, 10, 24);
  const offer = buildOffer(all, pref, 3);
  await redis.set(keys.offeredSlots(tenant.slug, waId), JSON.stringify(offer.slots), "EX", OFFER_TTL);
  return offer;
}

export async function getOfferedSlots(tenant: TenantRow, waId: string): Promise<Slot[]> {
  const raw = await redis.get(keys.offeredSlots(tenant.slug, waId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Slot[];
  } catch {
    return [];
  }
}

export type ConfirmResult =
  | { ok: true; slot: Slot }
  | { ok: false; reason: "no_offer" | "invalid_index" | "slot_taken" };

export async function confirmSlot(
  tenant: TenantRow,
  lead: LeadRow,
  index: number,
  channel: MeetingChannel = "ligacao",
): Promise<ConfirmResult> {
  const slots = await getOfferedSlots(tenant, lead.wa_id);
  if (slots.length === 0) {
    logger.info({ tenant: tenant.slug, waId: lead.wa_id }, "confirmSlot: oferta expirada/inexistente");
    return { ok: false, reason: "no_offer" };
  }
  const pick = slots[index];
  if (!pick) {
    logger.warn({ tenant: tenant.slug, waId: lead.wa_id, index }, "confirmSlot: invalid index");
    return { ok: false, reason: "invalid_index" };
  }
  // A oferta fica cacheada por até 2h: reconfere que o horário não passou e que
  // ninguém ocupou o intervalo nesse meio-tempo — ANTES de cancelar a reunião
  // anterior do lead, pra ele nunca ficar sem nada marcado.
  const stillValid =
    new Date(pick.startISO).getTime() > Date.now() &&
    (await isIntervalFree(tenant, pick.startISO, pick.endISO, { excludeLeadId: lead.id }));
  if (!stillValid) {
    logger.info(
      { tenant: tenant.slug, waId: lead.wa_id, slot: pick.label },
      "confirmSlot: horário não está mais disponível — oferta será refeita",
    );
    await redis.del(keys.offeredSlots(tenant.slug, lead.wa_id));
    return { ok: false, reason: "slot_taken" };
  }
  // REMARCAÇÃO: cancela as reuniões futuras ainda ativas deste lead ANTES de
  // criar a nova — senão o horário antigo segue ocupando a agenda e os
  // lembretes do horário velho continuam disparando pro lead.
  const { rows: previous } = await pool.query<{ id: number; calendar_event_id: string; calendar_provider: string }>(
    `UPDATE appointments
        SET status = 'cancelled', status_changed_at = now(),
            outcome_note = 'remarcada: lead escolheu novo horário'
      WHERE lead_id = $1 AND tenant_id = $2
        AND status IN ('scheduled', 'confirmed')
        AND scheduled_at > now()
      RETURNING id, calendar_event_id, calendar_provider`,
    [lead.id, tenant.id],
  );
  for (const old of previous) {
    logger.info({ tenant: tenant.slug, waId: lead.wa_id, appointmentId: old.id }, "remarcação: reunião anterior cancelada");
    if (old.calendar_provider === "google") {
      await deleteEvent(tenant, old.calendar_event_id).catch(() => undefined);
    }
  }

  const channelLabel = channel === "video" ? "Vídeo chamada" : "Ligação";
  const created = await createEvent(tenant, {
    startISO: pick.startISO,
    endISO: pick.endISO,
    leadName: lead.nome ?? lead.slots.nome ?? lead.wa_id,
    leadWhatsapp: lead.wa_id,
    summary: `Call ${lead.nome ?? lead.slots.nome ?? "Lead"} — ${tenant.name} (${channelLabel})`,
    description: `WhatsApp: ${lead.wa_id}\nCanal: ${channelLabel}`,
  });
  await recordAppointment(
    tenant.id,
    lead.id,
    created.eventId,
    new Date(pick.startISO),
    new Date(pick.endISO),
    channel,
    created.provider,
  );
  await redis.del(keys.offeredSlots(tenant.slug, lead.wa_id));
  await notifyScheduled(tenant, lead, pick.label, channel);
  // Automação "reunião agendada" (ex: mandar material de preparação).
  try {
    const { fireTrigger } = await import("../core/automations.js");
    await fireTrigger(tenant.id, "appointment_scheduled", lead.id, {});
  } catch (err) {
    logger.warn({ err, leadId: lead.id }, "trigger appointment_scheduled falhou");
  }
  return { ok: true, slot: pick };
}

export function formatOffer(tenant: TenantRow, slots: Slot[]): string {
  if (!slots.length) {
    return `Não consegui encontrar horários disponíveis agora na agenda do ${tenant.owner_name}. Tem alguma preferência de dia/horário que te atende melhor?`;
  }
  const lines = slots.map((s, i) => `${i + 1}) ${s.label}`);
  // Asteriscos SIMPLES — WhatsApp não renderiza *duplo*.
  // Pergunta de horário PRIMEIRO (separada), canal depois — pra não confundir.
  return (
    `Tenho esses horários disponíveis na agenda do ${tenant.owner_name}:\n\n` +
    lines.join("\n") +
    "\n\nQual dia e horário fica melhor pra você?"
  );
}
