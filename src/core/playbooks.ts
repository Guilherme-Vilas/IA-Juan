import { pool } from "./db.js";

// Regras de negocio do playbook — antes hardcoded no TS (consorcio/imovel),
// agora dado no banco (coluna playbook_templates.config JSONB).
export type PricingRow = {
  carta_min: number;
  carta_max: number;
  prazo_meses: number;
  parcela_min: number;
  parcela_max: number;
  tipo: "imovel" | "auto";
};

export type PlaybookConfig = {
  pricing: PricingRow[];
  // S1->S2 avanca se QUALQUER um destes slots estiver presente.
  advance_s1_to_s2_any: string[];
  // S2->S3 avanca se QUALQUER grupo tiver TODOS os slots presentes.
  advance_s2_to_s3_groups: string[][];
  // Slots minimos antes de propor agendamento.
  required_slots_to_schedule: string[];
};

const DEFAULT_CONFIG: PlaybookConfig = {
  pricing: [],
  advance_s1_to_s2_any: ["interesse", "finalidade", "tipo_imovel"],
  advance_s2_to_s3_groups: [["capacidade_mensal", "valor_bem"]],
  required_slots_to_schedule: ["nome"],
};

export type PlaybookTemplateRow = {
  id: number;
  slug: string;
  name: string;
  segment: string;
  description: string;
  default_products: string[];
  default_rules: string;
  config: Partial<PlaybookConfig>;
  created_at: Date;
};

export async function listPlaybooks(): Promise<PlaybookTemplateRow[]> {
  const { rows } = await pool.query<PlaybookTemplateRow>(
    `SELECT * FROM playbook_templates ORDER BY segment ASC, name ASC`,
  );
  return rows;
}

// Resolve a config efetiva de um playbook (merge com defaults). Null slug -> defaults.
export async function getPlaybookConfig(slug: string | null): Promise<PlaybookConfig> {
  if (!slug) return DEFAULT_CONFIG;
  const { rows } = await pool.query<{ config: Partial<PlaybookConfig> }>(
    `SELECT config FROM playbook_templates WHERE slug = $1`,
    [slug],
  );
  const cfg = rows[0]?.config ?? {};
  return {
    pricing: cfg.pricing ?? DEFAULT_CONFIG.pricing,
    advance_s1_to_s2_any: cfg.advance_s1_to_s2_any ?? DEFAULT_CONFIG.advance_s1_to_s2_any,
    advance_s2_to_s3_groups: cfg.advance_s2_to_s3_groups ?? DEFAULT_CONFIG.advance_s2_to_s3_groups,
    required_slots_to_schedule: cfg.required_slots_to_schedule ?? DEFAULT_CONFIG.required_slots_to_schedule,
  };
}

export async function setTenantPlaybook(tenantId: number, slug: string) {
  await pool.query(`UPDATE tenants SET playbook_slug = $1, updated_at = now() WHERE id = $2`, [
    slug,
    tenantId,
  ]);
}
