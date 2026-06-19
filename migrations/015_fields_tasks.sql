-- CRM Lote 2: campos customizados por tenant + tarefas/lembretes no lead.

-- Definicoes de campos customizados (por tenant).
CREATE TABLE IF NOT EXISTS custom_field_defs (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'text'
    CHECK (type IN ('text','number','select','date','boolean')),
  options    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- p/ type=select
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_tenant ON custom_field_defs (tenant_id, position);

-- Valores dos campos customizados ficam num JSONB no lead, keyed by def.key.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Tarefas / lembretes ligados ao lead (ligar, visitar, enviar proposta...).
CREATE TABLE IF NOT EXISTS lead_tasks (
  id               BIGSERIAL PRIMARY KEY,
  tenant_id        BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id          BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  assigned_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  due_at           TIMESTAMPTZ,
  done_at          TIMESTAMPTZ,
  reminded_at      TIMESTAMPTZ,  -- evita lembrar duas vezes
  created_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead ON lead_tasks (lead_id, due_at);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_due ON lead_tasks (tenant_id, due_at) WHERE done_at IS NULL;
