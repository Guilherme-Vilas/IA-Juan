CREATE TABLE IF NOT EXISTS tenant_google_tokens (
  tenant_id      BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  owner_email    TEXT,
  access_token   TEXT,
  refresh_token  TEXT,
  scope          TEXT,
  token_type     TEXT,
  expiry_date    BIGINT,
  calendar_id    TEXT NOT NULL DEFAULT 'primary',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_google_tokens_email
  ON tenant_google_tokens(owner_email);
