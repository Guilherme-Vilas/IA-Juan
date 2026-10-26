import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWebhook, parseConnectionUpdate } from "../src/core/evolution.js";

function textPayload(overrides: Record<string, unknown> = {}, keyOverrides: Record<string, unknown> = {}) {
  return {
    instance: "juan",
    data: {
      key: { id: "MSG1", remoteJid: "5511999998888@s.whatsapp.net", fromMe: false, ...keyOverrides },
      pushName: "Fulano",
      messageTimestamp: 1760000000,
      message: { conversation: "oi, tenho interesse" },
      ...overrides,
    },
  };
}

test("parseWebhook: mensagem de texto básica", () => {
  const p = parseWebhook(textPayload());
  assert.ok(p);
  assert.equal(p.waId, "5511999998888");
  assert.equal(p.type, "text");
  assert.equal(p.text, "oi, tenho interesse");
  assert.equal(p.fromMe, false);
  assert.equal(p.pushName, "Fulano");
});

test("parseWebhook: grupo é ignorado", () => {
  const p = parseWebhook(textPayload({}, { remoteJid: "12036304@g.us" }));
  assert.equal(p, null);
});

test("parseWebhook: @lid usa o telefone real de remoteJidAlt", () => {
  const p = parseWebhook(
    textPayload({}, { remoteJid: "123456789012345@lid", remoteJidAlt: "5511999998888@s.whatsapp.net" }),
  );
  assert.ok(p);
  assert.equal(p.waId, "5511999998888");
});

test("parseWebhook: @lid sem alternativa mantém o lid (não quebra)", () => {
  const p = parseWebhook(textPayload({}, { remoteJid: "123456789012345@lid" }));
  assert.ok(p);
  assert.equal(p.waId, "123456789012345@lid");
});

test("parseWebhook: timestamp em segundos vira milissegundos (detecção de replay depende disso)", () => {
  const p = parseWebhook(textPayload());
  assert.ok(p);
  assert.equal(p.timestamp, 1760000000 * 1000);
});

test("parseWebhook: fromMe é preservado (takeover depende disso)", () => {
  const p = parseWebhook(textPayload({}, { fromMe: true }));
  assert.ok(p);
  assert.equal(p.fromMe, true);
});

test("parseWebhook: extendedTextMessage também vira texto", () => {
  const p = parseWebhook(textPayload({ message: { extendedTextMessage: { text: "olá!" } } }));
  assert.ok(p);
  assert.equal(p.text, "olá!");
});

test("parseWebhook: payload sem message é ignorado", () => {
  const p = parseWebhook(textPayload({ message: undefined }));
  assert.equal(p, null);
});

test("parseConnectionUpdate: evento CONNECTION_UPDATE (maiúsculo e com ponto)", () => {
  for (const event of ["CONNECTION_UPDATE", "connection.update"]) {
    const c = parseConnectionUpdate({ event, instance: "juan", data: { state: "close" } });
    assert.ok(c, event);
    assert.equal(c.instance, "juan");
    assert.equal(c.state, "close");
  }
});

test("parseConnectionUpdate: mensagem comum NÃO vira connection update", () => {
  assert.equal(parseConnectionUpdate(textPayload()), null);
});
