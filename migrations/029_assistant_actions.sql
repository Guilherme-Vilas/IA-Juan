-- Assistente Fase 3: ações propostas pela IA com confirmação humana.
-- Fluxo: IA propõe (proposed) → usuário confirma no card do chat → executa
-- (applied) com snapshot do estado anterior (auditoria + desfazer futuro).
-- NADA é escrito sem clique de confirmação.

CREATE TABLE IF NOT EXISTS assistant_actions (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      BIGINT,                        -- quem conversava quando foi proposta
  type         TEXT NOT NULL CHECK (type IN
    ('editar_prompt','pausar_campanha','retomar_campanha','limite_envio','bloquear_numero')),
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','applied','rejected','expired')),
  -- snapshot do estado ANTES de aplicar (auditoria/rollback)
  before       JSONB,
  applied_by   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assistant_actions_tenant
  ON assistant_actions (tenant_id, created_at DESC);
