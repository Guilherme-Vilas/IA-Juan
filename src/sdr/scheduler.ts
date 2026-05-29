import { redis, keys } from "../core/redis.js";
import { listFreeSlots, createEvent, type Slot } from "../core/calendar.js";
import { recordAppointment, type LeadRow, type MeetingChannel } from "../core/db.js";
import { notifyScheduled } from "./handoff.js";
import { logger } from "../core/logger.js";
import type { TenantRow } from "../core/tenants.js";

const OFFER_TTL = 60 * 60 * 2; // 2h

export async function fetchAndCacheSlots(tenant: TenantRow, waId: string): Promise<Slot[]> {
  const slots = (await listFreeSlots(tenant, 4)).slice(0, 3);
  await redis.set(keys.offeredSlots(tenant.slug, waId), JSON.stringify(slots), "EX", OFFER_TTL);
  return slots;
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

export async function confirmSlot(
  tenant: TenantRow,
  lead: LeadRow,
  index: number,
  channel: MeetingChannel = "ligacao",
): Promise<Slot | null> {
  const slots = await getOfferedSlots(tenant, lead.wa_id);
  const pick = slots[index];
  if (!pick) {
    logger.warn({ tenant: tenant.slug, waId: lead.wa_id, index }, "confirmSlot: invalid index");
    return null;
  }
  const channelLabel = channel === "video" ? "Vídeo chamada" : "Ligação";
  const eventId = await createEvent(tenant, {
    startISO: pick.startISO,
    endISO: pick.endISO,
    leadName: lead.nome ?? lead.slots.nome ?? lead.wa_id,
    leadWhatsapp: lead.wa_id,
    summary: `Call ${lead.nome ?? lead.slots.nome ?? "Lead"} — ${tenant.name} (${channelLabel})`,
    description: `WhatsApp: ${lead.wa_id}\nCanal: ${channelLabel}`,
  });
  await recordAppointment(tenant.id, lead.id, eventId, new Date(pick.startISO), channel);
  await redis.del(keys.offeredSlots(tenant.slug, lead.wa_id));
  await notifyScheduled(tenant, lead, pick.label, channel);
  return pick;
}

export function formatOffer(tenant: TenantRow, slots: Slot[]): string {
  if (!slots.length) {
    return `Não tenho horário aberto nos próximos dias na agenda do ${tenant.owner_name}. Tem alguma preferência de dia/horário que te atende melhor?`;
  }
  const lines = slots.map((s, i) => `${i + 1}) ${s.label}`);
  return (
    `Tenho esses horários disponíveis na agenda do ${tenant.owner_name}:\n\n` +
    lines.join("\n") +
    "\n\nQual prefere? E me diz também: você prefere **ligação** ou **vídeo chamada**?"
  );
}
