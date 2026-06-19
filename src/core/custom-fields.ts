import { pool } from "./db.js";

export type CustomFieldType = "text" | "number" | "select" | "date" | "boolean";

export type CustomFieldDef = {
  id: number;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  position: number;
};

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const VALID_TYPES: CustomFieldType[] = ["text", "number", "select", "date", "boolean"];

export async function listFieldDefs(tenantId: number): Promise<CustomFieldDef[]> {
  const { rows } = await pool.query<CustomFieldDef>(
    `SELECT id, key, label, type, options, position
       FROM custom_field_defs WHERE tenant_id = $1
      ORDER BY position ASC, id ASC`,
    [tenantId],
  );
  return rows;
}

export type FieldDefInput = {
  key: string;
  label: string;
  type?: CustomFieldType;
  options?: string[];
};

// Salva a lista inteira de definicoes (upsert por key + remove as ausentes).
export async function replaceFieldDefs(
  tenantId: number,
  defs: FieldDefInput[],
): Promise<{ ok: boolean; error?: string }> {
  const seen = new Set<string>();
  for (const d of defs) {
    const key = (d.key ?? "").trim().toLowerCase();
    if (!KEY_RE.test(key)) return { ok: false, error: `chave inválida: "${d.key}" (use a-z, 0-9, _)` };
    if (seen.has(key)) return { ok: false, error: `chave duplicada: ${key}` };
    seen.add(key);
    if (d.type && !VALID_TYPES.includes(d.type)) return { ok: false, error: `tipo inválido: ${d.type}` };
    if (!d.label?.trim()) return { ok: false, error: `rótulo obrigatório para ${key}` };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let pos = 0; pos < defs.length; pos++) {
      const d = defs[pos]!;
      await client.query(
        `INSERT INTO custom_field_defs (tenant_id, key, label, type, options, position)
         VALUES ($1,$2,$3,COALESCE($4,'text'),$5,$6)
         ON CONFLICT (tenant_id, key) DO UPDATE SET
           label = EXCLUDED.label, type = EXCLUDED.type,
           options = EXCLUDED.options, position = EXCLUDED.position`,
        [
          tenantId,
          d.key.trim().toLowerCase(),
          d.label.trim(),
          d.type ?? "text",
          JSON.stringify(Array.isArray(d.options) ? d.options : []),
          pos,
        ],
      );
    }
    const keys = defs.map((d) => d.key.trim().toLowerCase());
    if (keys.length) {
      await client.query(`DELETE FROM custom_field_defs WHERE tenant_id = $1 AND key <> ALL($2::text[])`, [
        tenantId,
        keys,
      ]);
    } else {
      await client.query(`DELETE FROM custom_field_defs WHERE tenant_id = $1`, [tenantId]);
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  } finally {
    client.release();
  }
}

// Mescla valores de campos customizados no lead (so as chaves enviadas).
export async function setLeadCustomFields(
  tenantId: number,
  waId: string,
  values: Record<string, unknown>,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE leads SET custom_fields = custom_fields || $1::jsonb, updated_at = now()
      WHERE tenant_id = $2 AND wa_id = $3`,
    [JSON.stringify(values), tenantId, waId],
  );
  return (rowCount ?? 0) > 0;
}
