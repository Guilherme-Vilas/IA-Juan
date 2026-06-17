import { openai } from "./llm.js";
import { config } from "../config.js";
import { logger } from "./logger.js";

// Modelo de embedding — text-embedding-3-small (1536 dims, barato ~$0.02/1M tokens).
const EMBED_MODEL = config.OPENAI_MODEL_EMBED;

// Gera embeddings em lote (a API aceita um array de inputs por chamada).
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  // Lotes de 96 pra não estourar limite de tokens por request.
  const BATCH = 96;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.replace(/\n+/g, " ").slice(0, 8000));
    const res = await openai.embeddings.create({ model: EMBED_MODEL, input: slice });
    for (const d of res.data) out.push(d.embedding as number[]);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v ?? [];
}

// Cosseno entre dois vetores. Sem pgvector — calculado em JS sobre os chunks do tenant.
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function logEmbedConfigOnce() {
  logger.debug({ model: EMBED_MODEL }, "embeddings model");
}
