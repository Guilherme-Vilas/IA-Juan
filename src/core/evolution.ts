import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "./logger.js";
import type { TenantRow } from "./tenants.js";

const client: AxiosInstance = axios.create({
  baseURL: config.EVOLUTION_BASE_URL,
  headers: { apikey: config.EVOLUTION_API_KEY },
  timeout: 15000,
});

export async function sendText(tenant: TenantRow, waId: string, text: string): Promise<void> {
  if (config.SIMULATOR_MODE) {
    logger.debug({ tenant: tenant.slug, waId, len: text.length }, "sendText suppressed (SIMULATOR_MODE)");
    return;
  }
  try {
    await client.post(`/message/sendText/${tenant.evolution_instance}`, {
      number: waId,
      text,
      options: { delay: 800, presence: "composing" },
    });
  } catch (err) {
    logger.error({ err, tenant: tenant.slug, waId }, "evolution.sendText failed");
    throw err;
  }
}

export async function sendPresence(
  tenant: TenantRow,
  waId: string,
  presence: "composing" | "paused" = "composing",
) {
  if (config.SIMULATOR_MODE) return;
  // "paused" não existe na API — pra parar a indicação é só não chamar mais.
  if (presence === "paused") return;
  try {
    // Evolution API v2.3.x: payload sem wrapper `options`, campos no root.
    await client.post(`/chat/sendPresence/${tenant.evolution_instance}`, {
      number: waId,
      delay: 800,
      presence, // "composing" | "recording"
    });
  } catch (err) {
    // não-crítico: presença é só "estímulo visual". Loga só status + msg curta.
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    logger.debug(
      { status: e.response?.status, data: e.response?.data, msg: e.message },
      "sendPresence skipped (non-fatal)",
    );
  }
}

// Checa se um ou mais números têm WhatsApp.
// Endpoint Evolution v2.x: POST /chat/whatsappNumbers/{instance}
// Body: { numbers: ["5511999998888", ...] }
// Resposta: Array<{ exists: boolean, jid: string, number: string }>
export async function checkWhatsappNumbers(
  tenant: TenantRow,
  numbers: string[],
): Promise<Map<string, boolean>> {
  if (numbers.length === 0) return new Map();
  if (config.SIMULATOR_MODE) {
    return new Map(numbers.map((n) => [n, true]));
  }
  try {
    const res = await client.post<Array<{ exists?: boolean; number?: string }>>(
      `/chat/whatsappNumbers/${tenant.evolution_instance}`,
      { numbers },
    );
    const map = new Map<string, boolean>();
    for (const item of res.data ?? []) {
      if (item.number) map.set(item.number, !!item.exists);
    }
    for (const n of numbers) {
      if (!map.has(n)) map.set(n, false);
    }
    return map;
  } catch (err) {
    logger.error({ err, tenant: tenant.slug }, "evolution.checkWhatsappNumbers failed");
    // se falhar, assume que todos existem pra não bloquear envio (a falha vem no send)
    return new Map(numbers.map((n) => [n, true]));
  }
}

export async function downloadMedia(tenant: TenantRow, messageId: string): Promise<Buffer> {
  const res = await client.post(
    `/chat/getBase64FromMediaMessage/${tenant.evolution_instance}`,
    { message: { key: { id: messageId } }, convertToMp4: false },
    { responseType: "json" },
  );
  const b64 = res.data?.base64 ?? res.data?.data?.base64;
  if (!b64) throw new Error("no base64 in media response");
  return Buffer.from(b64, "base64");
}

export type EvolutionInboundMessage = {
  instance: string;
  waId: string;
  messageId: string;
  fromMe: boolean;
  pushName?: string;
  type: "text" | "audio" | "image" | "other";
  text?: string;
  audioMessageId?: string;
  timestamp: number;
};

export function parseWebhook(payload: unknown): EvolutionInboundMessage | null {
  try {
    const p = payload as Record<string, unknown>;
    // Evolution coloca o nome da instancia no topo do payload do webhook.
    const instance =
      (typeof p.instance === "string" ? p.instance : null) ??
      (typeof (p.data as Record<string, unknown> | undefined)?.instance === "string"
        ? ((p.data as Record<string, unknown>).instance as string)
        : null);
    const data = (p.data ?? p) as Record<string, unknown>;
    const key = data.key as { id?: string; remoteJid?: string; fromMe?: boolean } | undefined;
    const message = data.message as Record<string, unknown> | undefined;
    if (!instance) return null;
    if (!key?.remoteJid || !key.id) return null;
    if (key.remoteJid.endsWith("@g.us")) return null;
    const waId = key.remoteJid.replace(/@s\.whatsapp\.net$/, "");
    const pushName = typeof data.pushName === "string" ? data.pushName : undefined;
    const ts = typeof data.messageTimestamp === "number" ? data.messageTimestamp : Date.now() / 1000;
    if (!message) return null;

    if (typeof (message as Record<string, unknown>).conversation === "string") {
      return {
        instance,
        waId,
        messageId: key.id,
        fromMe: !!key.fromMe,
        pushName,
        type: "text",
        text: (message as { conversation: string }).conversation,
        timestamp: Math.floor(ts * 1000),
      };
    }
    const ext = (message as { extendedTextMessage?: { text?: string } }).extendedTextMessage;
    if (ext?.text) {
      return {
        instance,
        waId,
        messageId: key.id,
        fromMe: !!key.fromMe,
        pushName,
        type: "text",
        text: ext.text,
        timestamp: Math.floor(ts * 1000),
      };
    }
    if ((message as { audioMessage?: unknown }).audioMessage) {
      return {
        instance,
        waId,
        messageId: key.id,
        fromMe: !!key.fromMe,
        pushName,
        type: "audio",
        audioMessageId: key.id,
        timestamp: Math.floor(ts * 1000),
      };
    }
    return {
      instance,
      waId,
      messageId: key.id,
      fromMe: !!key.fromMe,
      pushName,
      type: "other",
      timestamp: Math.floor(ts * 1000),
    };
  } catch (err) {
    logger.warn({ err }, "parseWebhook failed");
    return null;
  }
}
