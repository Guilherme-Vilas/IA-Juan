-- Fundacao SaaS: agenda interna, configuracao do agente, playbooks e lead scoring.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_label TEXT NOT NULL DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE leads
SET
  score =
    LEAST(
      100,
      5 * CASE WHEN COALESCE(nome, slots->>'nome') IS NOT NULL THEN 1 ELSE 0 END +
      15 * CASE WHEN slots ? 'interesse' OR slots ? 'tipo_imovel' OR slots ? 'finalidade' THEN 1 ELSE 0 END +
      20 * CASE WHEN slots ? 'renda_aproximada' OR slots ? 'capacidade_mensal' OR slots ? 'entrada_disponivel' THEN 1 ELSE 0 END +
      10 * CASE WHEN slots ? 'valor_bem' THEN 1 ELSE 0 END +
      10 * CASE WHEN slots ? 'prazo_decisao' OR slots ? 'prazo_meses' THEN 1 ELSE 0 END +
      10 * CASE WHEN state IN ('S4_AGENDAMENTO', 'S5_CONFIRMADO') THEN 1 ELSE 0 END
    ),
  score_label =
    CASE
      WHEN state = 'S5_CONFIRMADO' THEN 'pronto'
      WHEN state = 'S4_AGENDAMENTO' THEN 'quente'
      WHEN slots ? 'capacidade_mensal' OR slots ? 'renda_aproximada' OR slots ? 'entrada_disponivel' THEN 'morno'
      ELSE 'frio'
    END
WHERE score = 0;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE appointments a
SET ends_at = a.scheduled_at + ((t.meeting_duration_min || ' minutes')::interval)
FROM tenants t
WHERE a.tenant_id = t.id
  AND a.ends_at IS NULL;

ALTER TABLE appointments
  ALTER COLUMN ends_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time
  ON appointments(tenant_id, scheduled_at, ends_at);

CREATE TABLE IF NOT EXISTS tenant_working_hours (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, weekday)
);

INSERT INTO tenant_working_hours (tenant_id, weekday, start_time, end_time, active)
SELECT id, weekday, make_time(work_start_hour, 0, 0), make_time(work_end_hour, 0, 0), weekday BETWEEN 1 AND 5
FROM tenants
CROSS JOIN generate_series(1, 7) AS weekday
ON CONFLICT (tenant_id, weekday) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_calendar_blocks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_tenant_time
  ON tenant_calendar_blocks(tenant_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS tenant_agent_settings (
  tenant_id BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL DEFAULT 'Stella',
  tone TEXT NOT NULL DEFAULT 'consultivo, humano e objetivo',
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualification_rules TEXT NOT NULL DEFAULT '',
  handoff_rules TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenant_agent_settings
  (tenant_id, agent_name, tone, products, regions, qualification_rules, handoff_rules)
SELECT
  id,
  CASE WHEN slug = 'facilita' THEN 'Sofia' ELSE 'Stella' END,
  CASE WHEN slug = 'facilita'
    THEN 'semi-formal, pessoal, sem girias e com emojis moderados'
    ELSE 'humano, consultivo, curioso e firme na qualificacao'
  END,
  CASE WHEN slug = 'facilita'
    THEN '["imoveis", "financiamento imobiliario", "home equity"]'::jsonb
    ELSE '["consorcio imobiliario", "consorcio auto", "investimento patrimonial"]'::jsonb
  END,
  CASE WHEN slug = 'facilita'
    THEN '["Curitiba", "regiao metropolitana"]'::jsonb
    ELSE '[]'::jsonb
  END,
  CASE WHEN slug = 'facilita'
    THEN 'Qualificar renda, entrada, interesse real e disposicao para visita.'
    ELSE 'Qualificar profissao, renda/faixa de parcela, objetivo, valor do bem, prazo, lance e decisor antes de agendar.'
  END,
  'Passar para humano quando o lead pedir, ficar irritado, estiver qualificado ou fugir do escopo.'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS playbook_templates (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_rules TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO playbook_templates (slug, name, segment, description, default_products, default_rules)
VALUES
  (
    'consorcio-sdr',
    'SDR de consorcio',
    'consorcio',
    'Qualificacao para carta de credito, capacidade mensal, lance e decisor.',
    '["consorcio imobiliario", "consorcio auto"]'::jsonb,
    'Perguntar profissao, faixa de renda/parcela, valor pretendido, prazo, lance, decisor e urgencia antes de agendar.'
  ),
  (
    'imoveis-lancamento',
    'Imoveis de lancamento',
    'imobiliaria',
    'Atendimento para leads interessados em imoveis novos, visita e simulacao.',
    '["imoveis de lancamento", "financiamento imobiliario"]'::jsonb,
    'Perguntar renda, entrada, FGTS, regiao, finalidade e disponibilidade para visita.'
  ),
  (
    'home-equity',
    'Credito com garantia de imovel',
    'credito',
    'Pre-qualificacao para home equity.',
    '["home equity"]'::jsonb,
    'Validar propriedade, valor aproximado do imovel, objetivo do credito, renda e urgencia.'
  )
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS playbook_slug TEXT;

UPDATE tenants
SET playbook_slug = CASE WHEN slug = 'facilita' THEN 'imoveis-lancamento' ELSE 'consorcio-sdr' END
WHERE playbook_slug IS NULL;
