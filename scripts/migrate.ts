import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/core/db.js";
import { logger } from "../src/core/logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "..", "migrations");

async function run() {
  // Advisory lock global — serializa migrations entre réplicas (evita race no boot).
  // Qualquer réplica que perca a corrida espera o lock e depois pula tudo (já aplicado).
  await pool.query(`SELECT pg_advisory_lock(727274)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const { rows } = await pool.query(`SELECT 1 FROM _migrations WHERE name = $1`, [file]);
    if (rows.length) {
      logger.info({ file }, "skip (already applied)");
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    logger.info({ file }, "applying");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query(`INSERT INTO _migrations(name) VALUES ($1)`, [file]);
      await pool.query("COMMIT");
      logger.info({ file }, "applied");
    } catch (err) {
      await pool.query("ROLLBACK");
      logger.error({ err, file }, "migration failed");
      await pool.query(`SELECT pg_advisory_unlock(727274)`).catch(() => undefined);
      process.exit(1);
    }
  }
  await pool.query(`SELECT pg_advisory_unlock(727274)`).catch(() => undefined);
  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, "migrate fatal");
  process.exit(1);
});
