-- Convites com link expiravel (onboarding self-service).
-- O dono do SaaS (superadmin) gera um link; o convidado abre dentro da validade
-- e cria a conta. Dois tipos:
--   'new_tenant' -> cria empresa (tenant) + login do dono.
--   'add_user'   -> cria login vinculado a um tenant existente.
CREATE TABLE IF NOT EXISTS invites (
  id            BIGSERIAL PRIMARY KEY,
  -- Guardamos SOMENTE o hash do token (sha256). O token cru so existe na URL.
  token_hash    TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL CHECK (type IN ('new_tenant','add_user')),
  -- tenant alvo (NULL para new_tenant, que cria o tenant no aceite).
  tenant_id     BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
  -- papel do usuario no tenant (owner/admin/sdr/viewer).
  role          TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner','admin','sdr','viewer')),
  -- se setado, trava o convite a este email.
  email         TEXT,
  -- config opcional pre-definida pelo superadmin (ex: playbook padrao do tenant).
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- rotulo livre pro superadmin identificar o convite.
  note          TEXT NOT NULL DEFAULT '',
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  used_by_user  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON invites (token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON invites (tenant_id);
