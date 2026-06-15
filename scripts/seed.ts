import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/core/db.js";
import { redis } from "../src/core/redis.js";
import { logger } from "../src/core/logger.js";
import { upsertTenantPrompts } from "../src/core/tenant-prompts.js";
import { createUser, linkUserToTenant } from "../src/core/users.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsRoot = path.resolve(here, "..", "src", "sdr", "prompts");

// Le os .md em disco UMA vez (build/seed time) e move pro banco.
// Em runtime o app nao toca mais no filesystem.
function readMd(dir: string, name: string): string {
  const p = path.join(promptsRoot, dir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

async function seedPrompts() {
  const { rows } = await pool.query<{ id: number; slug: string; prompt_dir: string }>(
    `SELECT id, slug, prompt_dir FROM tenants`,
  );
  for (const t of rows) {
    const dir = t.prompt_dir || t.slug;
    if (!fs.existsSync(path.join(promptsRoot, dir))) {
      logger.warn({ tenant: t.slug, dir }, "seed: prompt dir não existe, pulando");
      continue;
    }
    await upsertTenantPrompts(t.id, {
      system: readMd(dir, "system.md"),
      knowledge: readMd(dir, "knowledge.md"),
      objections: readMd(dir, "objections.md"),
      examples: readMd(dir, "examples.md"),
    });
    logger.info({ tenant: t.slug }, "seed: prompts carregados no banco");
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn("seed: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não setados — pulando criação de admin");
    return;
  }
  const user = await createUser({ email, password, name: "Admin", is_superadmin: true });
  // Vincula o superadmin a todos os tenants existentes (conveniencia inicial).
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM tenants`);
  for (const t of rows) await linkUserToTenant(user.id, t.id, "owner");
  logger.info({ email }, "seed: superadmin criado e vinculado a todos os tenants");
}

async function run() {
  await seedPrompts();
  await seedAdmin();
  await pool.end();
  // Fecha a conexao persistente do Redis (aberta pelo import de tenant-prompts).
  // Sem isso o processo fica pendurado e o `&& index.ts` do entrypoint nunca roda.
  try {
    redis.disconnect();
  } catch {
    /* ignore */
  }
  logger.info("seed: concluído");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "seed fatal");
    process.exit(1);
  });
