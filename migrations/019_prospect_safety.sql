-- Prospecção Fase 1 (segurança): opt-out/blacklist global por tenant,
-- orçamento de envio por instância com warm-up do chip, retry de falhas
-- e novo status opted_out.

-- Blacklist por tenant: opt-outs (LGPD) e supressões manuais.
-- external_id segue o formato de prospects.external_id (wa_id ou slug LinkedIn).
CREATE TABLE IF NOT EXISTS prospect_blacklist (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'opt_out'
    CHECK (reason IN ('opt_out','manual','bounced')),
  -- de onde veio o bloqueio: 'campaign:<id>', 'manual', 'import'
  source       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospect_blacklist
  ON prospect_blacklist (tenant_id, external_id);

-- Orçamento POR INSTÂNCIA (tenant): teto diário somando todas as campanhas.
-- prospect_warmup_started_at marca o início da rampa de aquecimento do chip;
-- é setado no primeiro tick com campanha ativa e pode ser resetado ao trocar de chip.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS prospect_daily_cap INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS prospect_warmup_started_at TIMESTAMPTZ;

-- Retry de falha transitória: contador de tentativas + agendamento da próxima.
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

-- Novo status: respondeu pedindo pra não receber mais mensagens.
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_status_check
  CHECK (status IN ('pending','queued','sent','replied','failed','skipped','ready_for_manual','opted_out'));

-- Dedup cross-campanha: lookup por tenant+external.
CREATE INDEX IF NOT EXISTS idx_prospects_tenant_external
  ON prospects (tenant_id, external_id);
