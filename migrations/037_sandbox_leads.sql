-- Leads de sandbox ("Testar IA" no painel): conversas de teste que usam o
-- runTurn real mas NÃO podem aparecer no funil, inbox, métricas, scans nem
-- exports. A flag isola; as queries de leitura filtram.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_sandbox ON leads (tenant_id) WHERE is_sandbox;
