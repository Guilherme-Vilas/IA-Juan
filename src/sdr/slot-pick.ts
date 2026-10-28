import type { Slot } from "../core/calendar.js";

// Seleção de horários pra oferta — lógica PURA (testável sem agenda).
//
// Problema que isto resolve: a oferta antiga pegava os 3 primeiros slots livres
// em ordem cronológica → caíam todos no MESMO dia ("só tenho terça"), e a IA
// não tinha como consultar um dia pedido pelo lead → chutava disponibilidade.

export type SlotPreference = {
  // "YYYY-MM-DD" no fuso do tenant (o label do slot carrega a data local)
  dateISO?: string | null;
  periodo?: "manha" | "tarde" | null;
};

const dayKeyOf = (s: Slot) => s.startISO.slice(0, 10);
const hourOf = (s: Slot) => Number(s.startISO.slice(11, 13));

// Espalha a oferta por dias distintos: no máx `maxPerDay` por dia, varrendo os
// dias em rodadas (1º de cada dia, depois 2º de cada dia...) até juntar `n`.
export function pickDiverseSlots(slots: Slot[], n = 3, maxPerDay = 2): Slot[] {
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = dayKeyOf(s);
    const list = byDay.get(k) ?? [];
    if (list.length < maxPerDay) {
      list.push(s);
      byDay.set(k, list);
    }
  }
  const days = [...byDay.keys()].sort();
  const out: Slot[] = [];
  for (let round = 0; out.length < n && round < maxPerDay; round++) {
    for (const d of days) {
      if (out.length >= n) break;
      const s = byDay.get(d)![round];
      if (s) out.push(s);
    }
  }
  return out.sort((a, b) => a.startISO.localeCompare(b.startISO));
}

// Filtra pela preferência do lead (dia exato e/ou manhã/tarde).
// startISO vem no fuso do tenant (luxon toISO com zone), então o corte de hora
// local funciona direto na string.
export function filterSlotsByPreference(slots: Slot[], pref: SlotPreference): Slot[] {
  return slots.filter((s) => {
    if (pref.dateISO && dayKeyOf(s) !== pref.dateISO) return false;
    if (pref.periodo === "manha" && hourOf(s) >= 12) return false;
    if (pref.periodo === "tarde" && hourOf(s) < 12) return false;
    return true;
  });
}

// Oferta final: respeita a preferência quando dá; sem horário no dia pedido,
// devolve alternativas diversificadas e sinaliza pra IA ser honesta sobre isso.
export function buildOffer(
  all: Slot[],
  pref: SlotPreference | null,
  n = 3,
): { slots: Slot[]; prefUnavailable: boolean } {
  if (pref && (pref.dateISO || pref.periodo)) {
    const matching = filterSlotsByPreference(all, pref);
    if (matching.length > 0) {
      // No dia pedido pode oferecer mais de 2 do mesmo dia — o lead PEDIU o dia.
      return { slots: matching.slice(0, n), prefUnavailable: false };
    }
    return { slots: pickDiverseSlots(all, n), prefUnavailable: true };
  }
  return { slots: pickDiverseSlots(all, n), prefUnavailable: false };
}
