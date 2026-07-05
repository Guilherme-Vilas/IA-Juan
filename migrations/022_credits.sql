-- Créditos de prospecção (Fase 3.1): repassa o custo da API de busca de leads.
-- Modelo: 1 crédito = 1 lead com telefone. Recarga manual pelo superadmin.
-- Reserva no início da busca (hold), cobra os leads com telefone ao fim e
-- devolve o restante. Ledger imutável pra auditoria/conciliação.

-- Saldo por tenant. balance = gastável; reserved = em hold por buscas rodando.
CREATE TABLE IF NOT EXISTS tenant_credits (
  tenant_id  BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0,
  reserved   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (balance >= 0),
  CHECK (reserved >= 0)
);

-- Ledger imutável — 1 linha por movimento real (recarga/consumo/ajuste).
-- Holds NÃO entram aqui (não são gasto); só recarga e débito efetivo.
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,           -- + recarga, − consumo
  balance_after INTEGER NOT NULL,           -- total (balance+reserved) após o movimento
  kind          TEXT NOT NULL CHECK (kind IN ('topup','debit','adjust')),
  reason        TEXT,
  ref_type      TEXT,                        -- ex: 'discovery_search'
  ref_id        BIGINT,
  actor         TEXT,                        -- email do superadmin ou 'system'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_tenant ON credit_transactions (tenant_id, created_at DESC);

-- Reserva/cobrança por busca (settle idempotente: charged_credits NULL = pendente).
ALTER TABLE discovery_searches
  ADD COLUMN IF NOT EXISTS reserved_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charged_credits  INTEGER;

-- Toda conta de tenant começa com linha de crédito (saldo 0).
INSERT INTO tenant_credits (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
