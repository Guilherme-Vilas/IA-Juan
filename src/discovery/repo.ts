import { pool } from "../core/db.js";
import type { CnpjSearchFilters } from "./providers/casadosdados.js";

export type DiscoveryStatus = "queued" | "running" | "done" | "failed";

export type DiscoverySearchRow = {
  id: number;
  tenant_id: number;
  name: string;
  source: string;
  filters: CnpjSearchFilters;
  status: DiscoveryStatus;
  requested_count: number;
  found_count: number;
  with_phone_count: number;
  whatsapp_count: number;
  error_msg: string | null;
  exported_campaign_id: number | null;
  reserved_credits: number;
  charged_credits: number | null;
  created_at: Date;
  updated_at: Date;
};

export type DiscoveredLeadRow = {
  id: number;
  search_id: number;
  tenant_id: number;
  cnpj: string;
  company: string | null;
  contact_name: string | null;
  phone_raw: string | null;
  wa_id: string | null;
  has_whatsapp: boolean | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  cnae: string | null;
  capital_social: number | null;
  opened_at: Date | null;
  data: Record<string, unknown>;
  created_at: Date;
};

export async function createSearch(input: {
  tenant_id: number;
  name: string;
  filters: CnpjSearchFilters;
  requested_count: number;
  reserved_credits: number;
}): Promise<DiscoverySearchRow> {
  const { rows } = await pool.query<DiscoverySearchRow>(
    `INSERT INTO discovery_searches (tenant_id, name, filters, requested_count, reserved_credits)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.tenant_id, input.name, JSON.stringify(input.filters), input.requested_count, input.reserved_credits],
  );
  return rows[0]!;
}

export async function getSearch(id: number): Promise<DiscoverySearchRow | null> {
  const { rows } = await pool.query<DiscoverySearchRow>(
    `SELECT * FROM discovery_searches WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getSearchForTenant(tenantId: number, id: number): Promise<DiscoverySearchRow | null> {
  const { rows } = await pool.query<DiscoverySearchRow>(
    `SELECT * FROM discovery_searches WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return rows[0] ?? null;
}

export async function listSearches(tenantId: number, limit = 50): Promise<DiscoverySearchRow[]> {
  const { rows } = await pool.query<DiscoverySearchRow>(
    `SELECT * FROM discovery_searches WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

export async function updateSearch(
  id: number,
  patch: Partial<
    Pick<
      DiscoverySearchRow,
      | "status"
      | "found_count"
      | "with_phone_count"
      | "whatsapp_count"
      | "error_msg"
      | "exported_campaign_id"
      | "charged_credits"
    >
  >,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(id);
  await pool.query(
    `UPDATE discovery_searches SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
    values,
  );
}

export async function deleteSearch(tenantId: number, id: number): Promise<void> {
  await pool.query(`DELETE FROM discovery_searches WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

export async function insertDiscoveredLead(input: {
  search_id: number;
  tenant_id: number;
  cnpj: string;
  company?: string | null;
  contact_name?: string | null;
  phone_raw?: string | null;
  wa_id?: string | null;
  email?: string | null;
  city?: string | null;
  uf?: string | null;
  cnae?: string | null;
  capital_social?: number | null;
  opened_at?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO discovered_leads
       (search_id, tenant_id, cnpj, company, contact_name, phone_raw, wa_id, email, city, uf, cnae, capital_social, opened_at, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (search_id, cnpj) DO NOTHING`,
    [
      input.search_id,
      input.tenant_id,
      input.cnpj,
      input.company ?? null,
      input.contact_name ?? null,
      input.phone_raw ?? null,
      input.wa_id ?? null,
      input.email ?? null,
      input.city ?? null,
      input.uf ?? null,
      input.cnae ?? null,
      input.capital_social ?? null,
      input.opened_at ?? null,
      JSON.stringify(input.data ?? {}),
    ],
  );
}

export async function listDiscoveredLeads(searchId: number, limit = 500): Promise<DiscoveredLeadRow[]> {
  const { rows } = await pool.query<DiscoveredLeadRow>(
    `SELECT * FROM discovered_leads WHERE search_id = $1 ORDER BY id ASC LIMIT $2`,
    [searchId, limit],
  );
  return rows;
}

export async function setLeadWhatsapp(id: number, has: boolean): Promise<void> {
  await pool.query(`UPDATE discovered_leads SET has_whatsapp = $1 WHERE id = $2`, [has, id]);
}
