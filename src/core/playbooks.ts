import { pool } from "./db.js";

export type PlaybookTemplateRow = {
  id: number;
  slug: string;
  name: string;
  segment: string;
  description: string;
  default_products: string[];
  default_rules: string;
  created_at: Date;
};

export async function listPlaybooks(): Promise<PlaybookTemplateRow[]> {
  const { rows } = await pool.query<PlaybookTemplateRow>(
    `SELECT * FROM playbook_templates ORDER BY segment ASC, name ASC`,
  );
  return rows;
}

export async function setTenantPlaybook(tenantId: number, slug: string) {
  await pool.query(`UPDATE tenants SET playbook_slug = $1, updated_at = now() WHERE id = $2`, [
    slug,
    tenantId,
  ]);
}
