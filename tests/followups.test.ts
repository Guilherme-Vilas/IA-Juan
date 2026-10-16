import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFollowupText, validateFollowupConfig, msUntilWorkWindow } from "../src/core/followups.js";
import type { TenantRow } from "../src/core/tenants.js";

test("renderFollowupText: substitui nome e primeiro_nome", () => {
  const out = renderFollowupText("Oi {primeiro_nome}! {nome}, conseguiu ver?", { nome: "Maria da Silva" });
  assert.equal(out, "Oi Maria! Maria da Silva, conseguiu ver?");
});

test("renderFollowupText: lead sem nome não deixa buraco feio", () => {
  const out = renderFollowupText("Oi {primeiro_nome}! Tudo bem?", { nome: null });
  assert.equal(out, "Oi! Tudo bem?");
});

test("validateFollowupConfig: limites de passos e tempos", () => {
  assert.equal(validateFollowupConfig({ steps: [] }), "informe ao menos 1 toque");
  assert.ok(validateFollowupConfig({ steps: [{ delay_minutes: 1, text: "oi" }] })); // < 5min
  assert.ok(validateFollowupConfig({ steps: [{ delay_minutes: 60, text: "" }] })); // sem texto
  assert.equal(validateFollowupConfig({ steps: [{ delay_minutes: 60, text: "oi" }] }), null); // válido
  const demais = Array.from({ length: 6 }, () => ({ delay_minutes: 60, text: "oi" }));
  assert.ok(validateFollowupConfig({ steps: demais })); // > máx
});

const tenantSp = {
  timezone: "America/Sao_Paulo",
  work_start_hour: 8,
  work_end_hour: 20,
} as TenantRow;

test("msUntilWorkWindow: dentro da janela → 0", () => {
  // 14:00 UTC = 11:00 em São Paulo (UTC-3)
  const now = new Date("2026-06-15T14:00:00Z");
  assert.equal(msUntilWorkWindow(tenantSp, now), 0);
});

test("msUntilWorkWindow: madrugada → espera até as 8h locais", () => {
  // 06:00 UTC = 03:00 em São Paulo → faltam 5h até as 8h
  const now = new Date("2026-06-15T06:00:00Z");
  const ms = msUntilWorkWindow(tenantSp, now);
  assert.ok(ms > 4.5 * 3_600_000 && ms <= 5.2 * 3_600_000, `esperado ~5h, veio ${ms / 3_600_000}h`);
});

test("msUntilWorkWindow: depois do expediente → espera até amanhã 8h", () => {
  // 23:30 UTC = 20:30 em São Paulo → faltam ~11.5h até as 8h
  const now = new Date("2026-06-15T23:30:00Z");
  const ms = msUntilWorkWindow(tenantSp, now);
  assert.ok(ms > 10 * 3_600_000 && ms <= 12.2 * 3_600_000, `esperado ~11.5h, veio ${ms / 3_600_000}h`);
});
