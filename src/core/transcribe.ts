import { toFile } from "openai";
import { openai } from "./llm.js";
import { config } from "../config.js";
import { logger } from "./logger.js";

export async function transcribeAudio(audio: Buffer, filename = "audio.ogg"): Promise<string> {
  try {
    const file = await toFile(audio, filename);
    const res = await openai.audio.transcriptions.create({
      file,
      model: config.OPENAI_MODEL_AUDIO,
      language: "pt",
      response_format: "text",
    });
    return typeof res === "string" ? res : (res as { text?: string }).text ?? "";
  } catch (err) {
    logger.error({ err }, "transcribe failed");
    return "";
  }
}
