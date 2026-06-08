import { pool } from "./db.js";

export type AgentSettingsRow = {
  tenant_id: number;
  agent_name: string;
  tone: string;
  products: string[];
  regions: string[];
  qualification_rules: string;
  handoff_rules: string;
  updated_at: Date;
};

export async function getAgentSettings(tenantId: number): Promise<AgentSettingsRow | null> {
  const { rows } = await pool.query<AgentSettingsRow>(
    `SELECT * FROM tenant_agent_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

export async function upsertAgentSettings(
  tenantId: number,
  patch: {
    agent_name: string;
    tone: string;
    products: string[];
    regions: string[];
    qualification_rules: string;
    handoff_rules: string;
  },
) {
  const { rows } = await pool.query<AgentSettingsRow>(
    `INSERT INTO tenant_agent_settings
       (tenant_id, agent_name, tone, products, regions, qualification_rules, handoff_rules)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id) DO UPDATE SET
       agent_name = EXCLUDED.agent_name,
       tone = EXCLUDED.tone,
       products = EXCLUDED.products,
       regions = EXCLUDED.regions,
       qualification_rules = EXCLUDED.qualification_rules,
       handoff_rules = EXCLUDED.handoff_rules,
       updated_at = now()
     RETURNING *`,
    [
      tenantId,
      patch.agent_name,
      patch.tone,
      JSON.stringify(patch.products),
      JSON.stringify(patch.regions),
      patch.qualification_rules,
      patch.handoff_rules,
    ],
  );
  return rows[0]!;
}
