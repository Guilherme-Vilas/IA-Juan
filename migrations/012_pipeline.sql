-- CRM: pipeline configuravel por tenant + reflexo 100% da acao automatica da IA.
--
-- Modelo de duas camadas:
--   - A IA raciocina em FASES CANONICAS estaveis (= leads.state: S0..S5, HANDOFF).
--   - A empresa monta a pipeline visual dela (pipeline_stages) e, pra cada coluna,
--     escolhe qual fase canonica a alimenta (trigger_state). O sistema recalcula a
--     coluna do lead a cada movimento da IA -> reflexo deterministico/100%.
--   - Colunas com trigger_state NULL sao MANUAIS (a IA nunca move pra elas).

CREATE TABLE IF NOT EXISTS pipelines (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Pipeline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id            BIGSERIAL PRIMARY KEY,
  pipeline_id   BIGINT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  position      INT NOT NULL DEFAULT 0,
  color         TEXT NOT NULL DEFAULT '#71717A',
  -- fase canonica que auto-move o lead pra ca; NULL = etapa manual (IA nao toca).
  trigger_state TEXT,
  is_won        BOOLEAN NOT NULL DEFAULT false,
  is_lost       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages (pipeline_id, position);
-- Cada fase canonica alimenta NO MAXIMO 1 coluna por pipeline (mapeamento deterministico).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_stage_trigger
  ON pipeline_stages (pipeline_id, trigger_state) WHERE trigger_state IS NOT NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage_id BIGINT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  -- quando um humano arrasta o lead, marcamos pra IA nao puxar de volta a coluna.
  ADD COLUMN IF NOT EXISTS stage_manual BOOLEAN NOT NULL DEFAULT false;

-- Auditoria: toda transicao de etapa (por IA, humano ou sistema).
CREATE TABLE IF NOT EXISTS lead_stage_events (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage_id BIGINT,
  to_stage_id   BIGINT,
  from_state    TEXT,
  to_state      TEXT,
  actor         TEXT NOT NULL DEFAULT 'system' CHECK (actor IN ('ai','human','system')),
  actor_user_id BIGINT,
  reason        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_lead ON lead_stage_events (lead_id, created_at);

-- ===== Seed pra tenants existentes: 1 pipeline + 7 etapas canonicas =====
INSERT INTO pipelines (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO pipeline_stages (pipeline_id, name, position, color, trigger_state)
SELECT p.id, s.name, s.position, s.color, s.trigger_state
FROM pipelines p
CROSS JOIN (VALUES
  ('Novo',               0, '#71717A', 'S0_ABERTURA'),
  ('Descoberta',         1, '#60A5FA', 'S1_DESCOBERTA'),
  ('Qualificação',       2, '#22D3EE', 'S2_QUALIFICACAO'),
  ('Educação',           3, '#FBBF24', 'S3_EDUCACAO'),
  ('Agendando',          4, '#C9A876', 'S4_AGENDAMENTO'),
  ('Agendado',           5, '#4ADE80', 'S5_CONFIRMADO'),
  ('Atendimento humano', 6, '#F87171', 'HANDOFF')
) AS s(name, position, color, trigger_state)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.pipeline_id = p.id);

-- Backfill: posiciona cada lead na etapa cujo trigger_state == leads.state.
UPDATE leads l
SET pipeline_stage_id = ps.id
FROM pipelines p
JOIN pipeline_stages ps ON ps.pipeline_id = p.id
WHERE p.tenant_id = l.tenant_id
  AND ps.trigger_state = l.state
  AND l.pipeline_stage_id IS NULL;
