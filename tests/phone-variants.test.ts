import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getPhoneVariants } from "../src/prospect/repo.js";

test("13 dígitos (55 + DDD + 9...): gera a variante sem o nono dígito", () => {
  const v = getPhoneVariants("5511987654321");
  assert.ok(v.includes("5511987654321"));
  assert.ok(v.includes("551187654321"), `variantes: ${v}`);
});

test("12 dígitos (55 + DDD + 8): gera a variante com o nono dígito", () => {
  const v = getPhoneVariants("551187654321");
  assert.ok(v.includes("5511987654321"), `variantes: ${v}`);
});

test("11 dígitos sem DDI: adiciona 55 nas duas formas", () => {
  const v = getPhoneVariants("11987654321");
  assert.ok(v.includes("5511987654321"));
  assert.ok(v.includes("551187654321"));
});

test("formatado com máscara: dígitos são extraídos", () => {
  const v = getPhoneVariants("+55 (11) 98765-4321");
  assert.ok(v.includes("5511987654321"), `variantes: ${v}`);
});
