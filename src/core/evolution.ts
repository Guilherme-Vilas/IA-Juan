import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "./logger.js";

const client: AxiosInstance = axios.create({
  baseURL: config.EVOLUTION_BASE_URL,
  headers: { apikey: config.EVOLUTION_API_KEY },
  timeout: 15000,
});

const INSTANCE = config.EVOLUTION_INSTANCE;

export async function sendText(waId: string, text: string): Promise<void> {
  if (config.SIMULATOR_MODE) {
    logger.debug({ waId, len: text.length }, "sendText suppressed (SIMULATOR_MODE)");
    return;
  }
  try {
    await client.post(`/message/sendText/${INSTANCE}`, {
      number: waId,
      text,
      options: { delay: 800, presence: "composing" },
    });
  } catch (err) {
    logger.error({ err, waId }, "evolution.sendText failed");
    throw err;
  }
}

export async function sendPresence(waId: string, presence: "composing" | "paused" = "composing") {
  if (config.SIMULATOR_MODE) return;
  // "paused" não existe na API — pra parar a indicação é só não chamar mais.
  if (presence === "paused") return;
  try {
    // Evolution API v2.3.x: payload sem wrapper `options`, campos no root.
    await client.post(`/chat/sendPresence/${INSTANCE}`, {
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
  numbers: string[],
): Promise<Map<string, boolean>> {
  if (numbers.length === 0) return new Map();
  if (config.SIMULATOR_MODE) {
    return new Map(numbers.map((n) => [n, true]));
  }
  try {
    const res = await client.post<Array<{ exists?: boolean; number?: string }>>(
      `/chat/whatsappNumbers/${INSTANCE}`,
      { numbers },
    );
    const map = new Map<string, boolean>();
    for (const item of res.data ?? []) {
      if (item.number) map.set(item.number, !!item.exists);
    }
    // garante chave pra cada input mesmo se Evolution não devolveu
    for (const n of numbers) {
      if (!map.has(n)) map.set(n, false);
    }
    return map;
  } catch (err) {
    logger.error({ err }, "evolution.checkWhatsappNumbers failed");
    // se falhar, assume que todos existem pra não bloquear envio (a falha vem no send)
    return new Map(numbers.map((n) => [n, true]));
  }
}

export async function downloadMedia(messageId: string): Promise<Buffer> {
  const res = await client.post(
    `/chat/getBase64FromMediaMessage/${INSTANCE}`,
    { message: { key: { id: messageId } }, convertToMp4: false },
    { responseType: "json" },
  );
  const b64 = res.data?.base64 ?? res.data?.data?.base64;
  if (!b64) throw new Error("no base64 in media response");
  return Buffer.from(b64, "base64");
}

export type EvolutionInboundMessage = {
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
    const data = (p.data ?? p) as Record<string, unknown>;
    const key = data.key as { id?: string; remoteJid?: string; fromMe?: boolean } | undefined;
    const message = data.message as Record<string, unknown> | undefined;
    if (!key?.remoteJid || !key.id) return null;
    if (key.remoteJid.endsWith("@g.us")) return null;
    const waId = key.remoteJid.replace(/@s\.whatsapp\.net$/, "");
    const pushName = typeof data.pushName === "string" ? data.pushName : undefined;
    const ts = typeof data.messageTimestamp === "number" ? data.messageTimestamp : Date.now() / 1000;
    if (!message) return null;

    if (typeof (message as Record<string, unknown>).conversation === "string") {
      return {
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
        waId,
        messageId: key.id,
        fromMe: !!key.fromMe,
        pushName,
        type: "audio",
        audioMessageId: key.id,
        timestamp: Math.floor(ts * 1000),
      };
    }
    return { waId, messageId: key.id, fromMe: !!key.fromMe, pushName, type: "other", timestamp: Math.floor(ts * 1000) };
  } catch (err) {
    logger.warn({ err }, "parseWebhook failed");
    return null;
  }
}
