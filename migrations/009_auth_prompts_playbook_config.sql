-- Modernizacao SaaS: auth multi-tenant, prompts no banco, playbook dinamico.

-- ============== USERS + RBAC ==============
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  is_superadmin BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vinculo usuario <-> tenant com papel. Um usuario pode pertencer a N tenants.
CREATE TABLE IF NOT EXISTS user_tenants (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner','admin','sdr','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants (tenant_id);

-- ============== PROMPTS NO BANCO ==============
-- Elimina leitura de .md do filesystem em runtime. Seed feito por scripts/seed-prompts.ts.
CREATE TABLE IF NOT EXISTS tenant_prompts (
  tenant_id   BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  system      TEXT NOT NULL DEFAULT '',
  knowledge   TEXT NOT NULL DEFAULT '',
  objections  TEXT NOT NULL DEFAULT '',
  examples    TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============== PLAYBOOK DINAMICO ==============
-- config JSONB carrega: pricing[], stage_requirements{}, required_slots_to_schedule[].
-- Isso tira a regra de negocio (consorcio/imovel) do TS e poe no banco por segmento.
ALTER TABLE playbook_templates
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Config do playbook de consorcio (regras do Juan, agora dado).
UPDATE playbook_templates SET config = '{
  "pricing": [
    {"carta_min":200000,"carta_max":250000,"prazo_meses":200,"parcela_min":1600,"parcela_max":2200,"tipo":"imovel"},
    {"carta_min":250000,"carta_max":300000,"prazo_meses":200,"parcela_min":1900,"parcela_max":2500,"tipo":"imovel"},
    {"carta_min":300000,"carta_max":400000,"prazo_meses":200,"parcela_min":2200,"parcela_max":3000,"tipo":"imovel"},
    {"carta_min":400000,"carta_max":500000,"prazo_meses":200,"parcela_min":2400,"parcela_max":3300,"tipo":"imovel"},
    {"carta_min":500000,"carta_max":600000,"prazo_meses":240,"parcela_min":2800,"parcela_max":3700,"tipo":"imovel"},
    {"carta_min":600000,"carta_max":700000,"prazo_meses":240,"parcela_min":3200,"parcela_max":4200,"tipo":"imovel"},
    {"carta_min":700000,"carta_max":800000,"prazo_meses":240,"parcela_min":3700,"parcela_max":4800,"tipo":"imovel"},
    {"carta_min":800000,"carta_max":1000000,"prazo_meses":240,"parcela_min":4200,"parcela_max":5800,"tipo":"imovel"},
    {"carta_min":80000,"carta_max":110000,"prazo_meses":80,"parcela_min":1100,"parcela_max":1500,"tipo":"auto"},
    {"carta_min":110000,"carta_max":150000,"prazo_meses":100,"parcela_min":1400,"parcela_max":1900,"tipo":"auto"},
    {"carta_min":150000,"carta_max":200000,"prazo_meses":100,"parcela_min":1700,"parcela_max":2400,"tipo":"auto"},
    {"carta_min":200000,"carta_max":300000,"prazo_meses":100,"parcela_min":2200,"parcela_max":3200,"tipo":"auto"}
  ],
  "advance_s1_to_s2_any": ["interesse","finalidade","tipo_imovel"],
  "advance_s2_to_s3_groups": [["capacidade_mensal","valor_bem","intencao_lance"]],
  "required_slots_to_schedule": ["nome","capacidade_mensal","valor_bem"]
}'::jsonb
WHERE slug = 'consorcio-sdr';

-- Config do playbook de imoveis (regras Apolar/Facilita).
UPDATE playbook_templates SET config = '{
  "pricing": [],
  "advance_s1_to_s2_any": ["interesse","finalidade","tipo_imovel"],
  "advance_s2_to_s3_groups": [["capacidade_mensal","entrada_disponivel","tipo_imovel"]],
  "required_slots_to_schedule": ["nome","capacidade_mensal","entrada_disponivel"]
}'::jsonb
WHERE slug = 'imoveis-lancamento';

UPDATE playbook_templates SET config = '{
  "pricing": [],
  "advance_s1_to_s2_any": ["interesse","finalidade"],
  "advance_s2_to_s3_groups": [["capacidade_mensal","valor_bem"]],
  "required_slots_to_schedule": ["nome","valor_bem"]
}'::jsonb
WHERE slug = 'home-equity';
