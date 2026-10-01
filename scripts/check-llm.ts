import { config } from "../src/config.js";
import { openai } from "../src/core/llm.js";

// Smoke test da credencial da OpenAI — rode depois de trocar a OPENAI_API_KEY:
//   npx tsx scripts/check-llm.ts            (local)
//   docker compose exec api npx tsx scripts/check-llm.ts   (produção)
async function run() {
  const key = config.OPENAI_API_KEY;
  const fingerprint = `${key.slice(0, 10)}…${key.slice(-4)} (${key.length} chars)`;
  console.log(`Chave carregada: ${fingerprint}`);
  if (/\s/.test(key)) {
    console.error("⚠️  A chave contém espaço/quebra de linha — conserte o .env.");
  }

  for (const [label, model] of [
    ["main", config.OPENAI_MODEL_MAIN],
    ["fast", config.OPENAI_MODEL_FAST],
  ] as const) {
    try {
      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "responda apenas: ok" }],
        max_tokens: 3,
      });
      console.log(`✅ ${label} (${model}): ${res.choices[0]?.message?.content?.trim() ?? "(sem texto)"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ ${label} (${model}): ${msg}`);
      process.exitCode = 1;
    }
  }
}

run();
