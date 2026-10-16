import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectOptOut } from "../src/prospect/suppression.js";

test("detectOptOut: pedidos claros de parar DEVEM bloquear", () => {
  const positives = [
    "para de me mandar mensagem",
    "PARE",
    "não me mande mais nada",
    "me tira dessa lista",
    "quero me descadastrar",
    "não quero receber",
    "me exclui",
    "stop",
  ];
  for (const t of positives) assert.equal(detectOptOut(t), true, `deveria ser opt-out: "${t}"`);
});

test("detectOptOut: conversa normal NÃO pode bloquear (falso positivo = lead perdido)", () => {
  const negatives = [
    "oi, tenho interesse",
    "quanto custa?",
    "me manda mais detalhes",
    "parei de pagar o financiamento, tem como ajudar?",
    "não quero financiamento, quero consórcio",
    "pode me ligar amanhã",
    "to sem parar em casa, me chama mais tarde",
  ];
  for (const t of negatives) assert.equal(detectOptOut(t), false, `falso positivo: "${t}"`);
});
