-- Prospecção Fase 2: cadência multi-etapa (stop-on-reply), variantes A/B
-- e classificação de resposta com IA.

-- Passos da cadência: posição 1..N, espera em horas desde o envio anterior.
CREATE TABLE IF NOT EXISTS campaign_steps (
  id            BIGSERIAL PRIMARY KEY,
  campaign_id   BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  wait_hours    INTEGER NOT NULL DEFAULT 48,
  template_text TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, position)
);

-- Variantes A/B por passo. O template do próprio passo é a variante base ("A");
-- estas são as alternativas (B, C...) sorteadas com peso igual.
CREATE TABLE IF NOT EXISTS campaign_step_variants (
  id            BIGSERIAL PRIMARY KEY,
  step_id       BIGINT NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  template_text TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, label)
);

-- Log de envios: 1 linha por mensagem que saiu. Base das métricas por
-- passo/variante e da contagem de orçamento (rate/dia por campanha e por chip).
CREATE TABLE IF NOT EXISTS prospect_sends (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    BIGINT NOT NULL,
  campaign_id  BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id  BIGINT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  step_id      BIGINT REFERENCES campaign_steps(id) ON DELETE SET NULL,
  variant_id   BIGINT REFERENCES campaign_step_variants(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_sends_campaign ON prospect_sends (campaign_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_prospect_sends_tenant ON prospect_sends (tenant_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_prospect_sends_prospect ON prospect_sends (prospect_id, sent_at);

-- Estado da cadência no prospect + classe da resposta (IA).
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_class TEXT
    CHECK (reply_class IN ('interessado','nao_interessado','depois','opt_out','neutro') OR reply_class IS NULL);

-- Compat: campanhas existentes ganham o passo 1 a partir do template atual.
INSERT INTO campaign_steps (campaign_id, position, wait_hours, template_text)
SELECT c.id, 1, 0, c.template_text
  FROM campaigns c
 WHERE NOT EXISTS (SELECT 1 FROM campaign_steps s WHERE s.campaign_id = c.id);

-- Prospects já tocados no fluxo antigo (single-step) entram na contabilidade nova.
UPDATE prospects
   SET current_step = 1
 WHERE status IN ('sent','replied','ready_for_manual','opted_out') AND current_step = 0;

-- Backfill do log de envios (melhor esforço: tudo era passo 1).
INSERT INTO prospect_sends (tenant_id, campaign_id, prospect_id, step_id, message_text, sent_at)
SELECT p.tenant_id, p.campaign_id, p.id, s.id, COALESCE(p.composed_message, ''), COALESCE(p.sent_at, p.updated_at)
  FROM prospects p
  JOIN campaign_steps s ON s.campaign_id = p.campaign_id AND s.position = 1
 WHERE p.sent_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM prospect_sends x WHERE x.prospect_id = p.id);
