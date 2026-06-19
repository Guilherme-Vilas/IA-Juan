-- CRM Lote 4: catalogo de imoveis (por tenant). A IA recomenda do catalogo e
-- o feed XML publico alimenta os portais (ZAP/VivaReal/OLX).
CREATE TABLE IF NOT EXISTS properties (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ref          TEXT NOT NULL DEFAULT '',          -- codigo do imovel (do cliente)
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  transaction  TEXT NOT NULL DEFAULT 'venda' CHECK (transaction IN ('venda','locacao')),
  type         TEXT NOT NULL DEFAULT 'apartamento', -- apartamento/casa/terreno/comercial/...
  status       TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel','reservado','vendido','inativo')),
  price_cents  BIGINT,                            -- preco de venda OU aluguel mensal
  condo_cents  BIGINT,
  iptu_cents   BIGINT,
  bedrooms     INT,
  bathrooms    INT,
  suites       INT,
  parking      INT,
  area_m2      NUMERIC,
  neighborhood TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',
  state        TEXT NOT NULL DEFAULT '',          -- UF
  address      TEXT NOT NULL DEFAULT '',
  features     JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["piscina","churrasqueira"]
  photos       JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["https://...jpg"]
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_search
  ON properties (tenant_id, transaction, type, city, neighborhood);
