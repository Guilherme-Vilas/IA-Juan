-- CRM Lote 3: captura de leads (ingestao externa) + origem/UTM.

ALTER TABLE tenants
  -- token de ingestao (gerado pelo app; protege o endpoint publico /ingest/lead).
  ADD COLUMN IF NOT EXISTS ingest_token TEXT,
  -- saudacao opcional disparada no WhatsApp quando um lead e capturado com telefone.
  ADD COLUMN IF NOT EXISTS capture_greeting TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_ingest_token
  ON tenants (ingest_token) WHERE ingest_token IS NOT NULL;

ALTER TABLE leads
  -- detalhe da origem: utm_source/medium/campaign, anuncio, formulario, etc.
  ADD COLUMN IF NOT EXISTS source_detail JSONB NOT NULL DEFAULT '{}'::jsonb;
