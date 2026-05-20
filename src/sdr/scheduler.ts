import { redis } from "../core/redis.js";
import { listFreeSlots, createEvent, type Slot } from "../core/calendar.js";
import { recordAppointment, type LeadRow, type MeetingChannel } from "../core/db.js";
import { notifyScheduled } from "./handoff.js";
import { logger } from "../core/logger.js";

const OFFER_KEY = (waId: string) => `lead:${waId}:offered_slots`;
const OFFER_TTL = 60 * 60 * 2; // 2h

export async function fetchAndCacheSlots(waId: string): Promise<Slot[]> {
  const slots = (await listFreeSlots(4)).slice(0, 3);
  await redis.set(OFFER_KEY(waId), JSON.stringify(slots), "EX", OFFER_TTL);
  return slots;
}

export async function getOfferedSlots(waId: string): Promise<Slot[]> {
  const raw = await redis.get(OFFER_KEY(waId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Slot[];
  } catch {
    return [];
  }
}

export async function confirmSlot(
  lead: LeadRow,
  index: number,
  channel: MeetingChannel = "ligacao",
): Promise<Slot | null> {
  const slots = await getOfferedSlots(lead.wa_id);
  const pick = slots[index];
  if (!pick) {
    logger.warn({ waId: lead.wa_id, index }, "confirmSlot: invalid index");
    return null;
  }
  const channelLabel = channel === "video" ? "Vídeo chamada" : "Ligação";
  const eventId = await createEvent({
    startISO: pick.startISO,
    endISO: pick.endISO,
    leadName: lead.nome ?? lead.slots.nome ?? lead.wa_id,
    leadWhatsapp: lead.wa_id,
    summary: `Call ${lead.nome ?? lead.slots.nome ?? "Lead"} — Consórcio (${channelLabel})`,
    description: `WhatsApp: ${lead.wa_id}\nCanal: ${channelLabel}`,
  });
  await recordAppointment(lead.id, eventId, new Date(pick.startISO), channel);
  await redis.del(OFFER_KEY(lead.wa_id));
  await notifyScheduled(lead, pick.label, channel);
  return pick;
}

export function formatOffer(slots: Slot[]): string {
  if (!slots.length) {
    return "Não tenho horário aberto nos próximos dias na agenda do Juan. Tem alguma preferência de dia/horário que te atende melhor?";
  }
  const lines = slots.map((s, i) => `${i + 1}) ${s.label}`);
  return (
    "Tenho esses horários disponíveis na agenda do Juan:\n\n" +
    lines.join("\n") +
    "\n\nQual prefere? E me diz também: você prefere **ligação** ou **vídeo chamada**?"
  );
}
