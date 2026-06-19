-- CRM Lote 1: valor do negocio, atribuicao de vendedor (+round-robin), notas internas.

ALTER TABLE leads
  -- valor do negocio em centavos (forecast e receita ganha).
  ADD COLUMN IF NOT EXISTS value_cents BIGINT,
  -- vendedor responsavel pelo lead.
  ADD COLUMN IF NOT EXISTS assigned_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads (tenant_id, assigned_user_id);

ALTER TABLE tenants
  -- como distribuir leads novos: manual ou round-robin entre os vendedores.
  ADD COLUMN IF NOT EXISTS lead_distribution TEXT NOT NULL DEFAULT 'manual'
    CHECK (lead_distribution IN ('manual','round_robin')),
  -- ponteiro do round-robin (ultimo vendedor que recebeu).
  ADD COLUMN IF NOT EXISTS last_assigned_user_id BIGINT;

-- Notas internas do time no lead (nao vao pro WhatsApp).
CREATE TABLE IF NOT EXISTS lead_notes (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id    BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes (lead_id, created_at);
