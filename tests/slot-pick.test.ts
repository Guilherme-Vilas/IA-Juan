import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDiverseSlots, filterSlotsByPreference, buildOffer } from "../src/sdr/slot-pick.js";
import type { Slot } from "../src/core/calendar.js";

const slot = (dateTime: string): Slot => ({
  startISO: `${dateTime}:00.000-03:00`,
  endISO: `${dateTime}:00.000-03:00`,
  label: dateTime,
});

// Agenda típica: vários horários por dia, dias seguidos.
const AGENDA: Slot[] = [
  slot("2026-10-27T13:40"),
  slot("2026-10-27T15:50"),
  slot("2026-10-27T17:35"),
  slot("2026-10-28T09:15"),
  slot("2026-10-28T14:25"),
  slot("2026-10-29T10:40"),
  slot("2026-10-29T16:20"),
];

test("pickDiverseSlots: a oferta espalha por dias distintos (regressão do 'só tenho terça')", () => {
  const picked = pickDiverseSlots(AGENDA, 3);
  const days = new Set(picked.map((s) => s.startISO.slice(0, 10)));
  assert.equal(picked.length, 3);
  assert.equal(days.size, 3, `esperado 3 dias distintos, veio: ${[...days]}`);
});

test("pickDiverseSlots: com um dia só disponível, oferece o que há (até o teto por dia)", () => {
  const umDia = AGENDA.filter((s) => s.startISO.startsWith("2026-10-27"));
  const picked = pickDiverseSlots(umDia, 3);
  assert.equal(picked.length, 2); // maxPerDay = 2
});

test("filterSlotsByPreference: dia exato", () => {
  const out = filterSlotsByPreference(AGENDA, { dateISO: "2026-10-28" });
  assert.equal(out.length, 2);
  assert.ok(out.every((s) => s.startISO.startsWith("2026-10-28")));
});

test("filterSlotsByPreference: manhã e tarde cortam pela hora LOCAL", () => {
  const manha = filterSlotsByPreference(AGENDA, { periodo: "manha" });
  assert.deepEqual(
    manha.map((s) => s.startISO.slice(11, 16)),
    ["09:15", "10:40"],
  );
  const tardeQuinta = filterSlotsByPreference(AGENDA, { dateISO: "2026-10-29", periodo: "tarde" });
  assert.equal(tardeQuinta.length, 1);
});

test("buildOffer: preferência atendida usa os horários DO dia pedido", () => {
  const { slots, prefUnavailable } = buildOffer(AGENDA, { dateISO: "2026-10-28" });
  assert.equal(prefUnavailable, false);
  assert.ok(slots.every((s) => s.startISO.startsWith("2026-10-28")));
});

test("buildOffer: dia pedido sem horário → alternativas reais + sinal de indisponível (regressão do 'quinta ou sexta?')", () => {
  const { slots, prefUnavailable } = buildOffer(AGENDA, { dateISO: "2026-10-30" });
  assert.equal(prefUnavailable, true);
  assert.equal(slots.length, 3); // alternativas diversificadas, nunca lista vazia muda
});

test("buildOffer: sem preferência = oferta diversificada padrão", () => {
  const { slots, prefUnavailable } = buildOffer(AGENDA, null);
  assert.equal(prefUnavailable, false);
  assert.equal(new Set(slots.map((s) => s.startISO.slice(0, 10))).size, 3);
});
