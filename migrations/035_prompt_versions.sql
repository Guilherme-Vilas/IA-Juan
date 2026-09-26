-- Histórico de versões dos prompts da IA: toda edição salva um snapshot do
-- estado ANTERIOR. Rede de segurança pra edição pelo painel — dá pra voltar.

CREATE TABLE IF NOT EXISTS tenant_prompt_versions (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system      TEXT NOT NULL DEFAULT '',
  knowledge   TEXT NOT NULL DEFAULT '',
  objections  TEXT NOT NULL DEFAULT '',
  examples    TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_tenant
  ON tenant_prompt_versions (tenant_id, created_at DESC);
