import { pool } from "./db.js";

export type GoogleTokenRow = {
  tenant_id: number;
  owner_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null;
  calendar_id: string;
  created_at: Date;
  updated_at: Date;
};

export async function getGoogleTokens(tenantId: number): Promise<GoogleTokenRow | null> {
  const { rows } = await pool.query<GoogleTokenRow>(
    `SELECT * FROM tenant_google_tokens WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

export async function upsertGoogleTokens(
  tenantId: number,
  patch: {
    owner_email?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string | null;
    token_type?: string | null;
    expiry_date?: number | null;
    calendar_id?: string | null;
  },
): Promise<GoogleTokenRow> {
  const { rows } = await pool.query<GoogleTokenRow>(
    `INSERT INTO tenant_google_tokens
       (tenant_id, owner_email, access_token, refresh_token, scope, token_type, expiry_date, calendar_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'primary'))
     ON CONFLICT (tenant_id) DO UPDATE SET
       owner_email = COALESCE(EXCLUDED.owner_email, tenant_google_tokens.owner_email),
       access_token = COALESCE(EXCLUDED.access_token, tenant_google_tokens.access_token),
       refresh_token = COALESCE(EXCLUDED.refresh_token, tenant_google_tokens.refresh_token),
       scope = COALESCE(EXCLUDED.scope, tenant_google_tokens.scope),
       token_type = COALESCE(EXCLUDED.token_type, tenant_google_tokens.token_type),
       expiry_date = COALESCE(EXCLUDED.expiry_date, tenant_google_tokens.expiry_date),
       calendar_id = COALESCE(EXCLUDED.calendar_id, tenant_google_tokens.calendar_id),
       updated_at = now()
     RETURNING *`,
    [
      tenantId,
      patch.owner_email ?? null,
      patch.access_token ?? null,
      patch.refresh_token ?? null,
      patch.scope ?? null,
      patch.token_type ?? null,
      patch.expiry_date ?? null,
      patch.calendar_id ?? null,
    ],
  );
  return rows[0]!;
}

export async function updateGoogleAccessTokens(
  tenantId: number,
  patch: {
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string | null;
    token_type?: string | null;
    expiry_date?: number | null;
  },
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(tenantId);
  await pool.query(
    `UPDATE tenant_google_tokens
        SET ${fields.join(", ")}, updated_at = now()
      WHERE tenant_id = $${i}`,
    values,
  );
}

export async function setGoogleCalendarId(tenantId: number, calendarId: string) {
  await pool.query(
    `UPDATE tenant_google_tokens
        SET calendar_id = $1, updated_at = now()
      WHERE tenant_id = $2`,
    [calendarId, tenantId],
  );
}

export async function deleteGoogleTokens(tenantId: number) {
  await pool.query(`DELETE FROM tenant_google_tokens WHERE tenant_id = $1`, [tenantId]);
}
