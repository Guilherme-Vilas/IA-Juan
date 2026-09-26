-- Follow-up de conversa configurável por tenant (antes: 2 mensagens chumbadas
-- no código, com tempos globais por env e sem respeitar horário comercial).
-- steps: [{"delay_minutes": 40, "text": "..."}] — o delay é contado a partir
-- do toque anterior (ou da última fala da IA, no 1º passo).

CREATE TABLE IF NOT EXISTS tenant_followups (
  tenant_id           BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  steps               JSONB NOT NULL DEFAULT '[]'::jsonb,
  close_after_minutes INT NOT NULL DEFAULT 1440,
  work_hours_only     BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
