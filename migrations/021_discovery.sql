-- Prospecção Fase 3: motor de busca de leads (fonte CNPJ).
-- Uma "busca" roda em background: consulta a fonte com filtros de ICP,
-- enriquece cada CNPJ (telefone/sócios/email), valida WhatsApp e fica
-- pronta pra exportar como campanha.

CREATE TABLE IF NOT EXISTS discovery_searches (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  source                TEXT NOT NULL DEFAULT 'cnpj',
  filters               JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','failed')),
  requested_count       INTEGER NOT NULL DEFAULT 100,
  found_count           INTEGER NOT NULL DEFAULT 0,
  with_phone_count      INTEGER NOT NULL DEFAULT 0,
  whatsapp_count        INTEGER NOT NULL DEFAULT 0,
  error_msg             TEXT,
  exported_campaign_id  BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_searches_tenant
  ON discovery_searches (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS discovered_leads (
  id             BIGSERIAL PRIMARY KEY,
  search_id      BIGINT NOT NULL REFERENCES discovery_searches(id) ON DELETE CASCADE,
  tenant_id      BIGINT NOT NULL,
  cnpj           TEXT NOT NULL,
  company        TEXT,
  contact_name   TEXT,
  phone_raw      TEXT,
  wa_id          TEXT,
  has_whatsapp   BOOLEAN,
  email          TEXT,
  city           TEXT,
  uf             TEXT,
  cnae           TEXT,
  capital_social NUMERIC,
  opened_at      DATE,
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discovered_leads_search_cnpj
  ON discovered_leads (search_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_search ON discovered_leads (search_id);
