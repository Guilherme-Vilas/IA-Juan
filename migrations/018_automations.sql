-- CRM Lote 6: construtor de automacoes / cadencias (gatilho -> passos com espera).

-- Regra: gatilho + condicoes + lista ordenada de passos.
CREATE TABLE IF NOT EXISTS automations (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  -- lead_created | stage_entered | lead_won | lead_lost | no_reply
  trigger_type   TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {stage_id, hours}
  conditions     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {stage_id, min_score, source_contains}
  -- cancela a cadencia se o lead responder (evita ficar cutucando quem engajou).
  stop_on_reply  BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automations (tenant_id, enabled);

-- Passos ordenados. delay_minutes = espera ANTES de executar o passo.
CREATE TABLE IF NOT EXISTS automation_steps (
  id            BIGSERIAL PRIMARY KEY,
  automation_id BIGINT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  position      INT NOT NULL DEFAULT 0,
  delay_minutes INT NOT NULL DEFAULT 0,
  -- send_message | create_task | add_note | assign_round_robin | move_stage | notify_owner
  action_type   TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON automation_steps (automation_id, position);

-- Execucao de uma automacao pra um lead (avanca passo a passo no tick).
CREATE TABLE IF NOT EXISTS automation_runs (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id BIGINT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  lead_id       BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | done | cancelled
  current_step  INT NOT NULL DEFAULT 0,
  next_run_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_due ON automation_runs (next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_automation_runs_lead ON automation_runs (lead_id, status);
-- nao roda a mesma automacao 2x simultaneamente pro mesmo lead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_run_active
  ON automation_runs (automation_id, lead_id) WHERE status = 'active';
