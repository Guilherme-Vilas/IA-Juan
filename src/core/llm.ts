import OpenAI from "openai";
import { config } from "../config.js";
import { logger } from "./logger.js";

export const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function isRateLimit(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string } | null;
  if (!anyErr) return false;
  if (anyErr.status === 429) return true;
  return /rate.?limit/i.test(String(anyErr.message ?? ""));
}

type ChatOpts = {
  model?: "main" | "fast";
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
};

async function callOpenAI(model: string, opts: ChatOpts) {
  const started = Date.now();
  const res = await openai.chat.completions.create({
    model,
    messages: opts.messages as never,
    tools: opts.tools as never,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700,
  });
  logger.debug({ model, ms: Date.now() - started }, "openai.chat");
  return res.choices[0]!;
}

export async function chat(opts: ChatOpts) {
  const primary = opts.model === "fast" ? config.OPENAI_MODEL_FAST : config.OPENAI_MODEL_MAIN;
  const fallback = config.OPENAI_MODEL_FAST;

  try {
    return await callOpenAI(primary, opts);
  } catch (err) {
    if (isRateLimit(err) && primary !== fallback) {
      logger.warn({ primary, fallback }, "openai rate limit hit — trying fallback model");
      try {
        return await callOpenAI(fallback, opts);
      } catch (err2) {
        logger.error({ err: err2, model: fallback }, "openai.chat fallback also failed");
        throw err2;
      }
    }
    logger.error({ err, model: primary }, "openai.chat failed");
    throw err;
  }
}

export async function classify(prompt: string, options: string[]): Promise<string> {
  const choice = await chat({
    model: "fast",
    temperature: 0,
    maxTokens: 10,
    messages: [
      {
        role: "system",
        content:
          "Você classifica mensagens. Responda APENAS com uma das opções listadas, sem pontuação nem explicação.",
      },
      { role: "user", content: `${prompt}\n\nOpções: ${options.join(" | ")}` },
    ],
  });
  const text = (choice.message.content ?? "").trim().toLowerCase();
  return options.find((o) => text.includes(o.toLowerCase())) ?? options[0]!;
}
