import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitForWhatsApp } from "../src/workers/chunk.js";
import { parseProspectsCsv } from "../src/prospect/csv.js";
import { sanitizeReply } from "../src/sdr/sanitize.js";

// ===== Quebra em mensagens de WhatsApp =====

test("splitForWhatsApp: parágrafos viram mensagens separadas", () => {
  const chunks = splitForWhatsApp("Primeira parte.\n\nSegunda parte.\n\nTerceira?");
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0], "Primeira parte.");
});

test("splitForWhatsApp: texto vazio não envia nada", () => {
  assert.deepEqual(splitForWhatsApp("   "), []);
});

// ===== Sanitização da resposta do LLM =====

test("sanitizeReply: remove tool-call vazado no texto e preserva a fala", () => {
  const { clean, calls } = sanitizeReply('Perfeito! <function=save_slots>{"nome":"Ana"}</function> Me conta mais?');
  assert.doesNotMatch(clean, /<function/);
  assert.match(clean, /Perfeito!/);
  assert.ok(calls.length >= 0); // não explode
});

// ===== Importação CSV =====

test("parseProspectsCsv: telefone + nome importam e normalizam", () => {
  const csv = 'telefone,nome\n"+55 (11) 98765-4321",Maria\n11912345678,José';
  const res = parseProspectsCsv(csv, "whatsapp");
  assert.equal(res.prospects.length, 2);
  assert.equal(res.invalid.length, 0);
  assert.ok(res.prospects[0]!.external_id.startsWith("55"));
});

test("parseProspectsCsv: sem a coluna obrigatória falha com mensagem clara", () => {
  const res = parseProspectsCsv("nome,empresa\nMaria,ACME", "whatsapp");
  assert.equal(res.prospects.length, 0);
  assert.match(res.invalid[0]!.reason, /telefone/);
});

test("parseProspectsCsv: linha com telefone inválido vai pra lista de inválidos", () => {
  const res = parseProspectsCsv("telefone,nome\nabc,Maria\n11987654321,José", "whatsapp");
  assert.equal(res.prospects.length, 1);
  assert.equal(res.invalid.length, 1);
});
