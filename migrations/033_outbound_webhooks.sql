-- Webhooks de SAÍDA: o tenant integra a plataforma com o mundo (Zapier, Make,
-- CRM externo). Cada evento assinado com HMAC-SHA256 do secret.

CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     TEXT NOT NULL,
  -- lead.created | lead.scheduled | lead.won | lead.lost | appointment.no_show
  events     TEXT[] NOT NULL DEFAULT '{}',
  enabled    BOOLEAN NOT NULL DEFAULT true,
  last_ok_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_tenant ON tenant_webhooks (tenant_id, enabled);
