-- E-mail marketing INTERNO (superadmin): nutrir interessados na PLATAFORMA.
-- Não é feature de tenant — é a máquina de marketing da própria Vita OS.

CREATE TABLE IF NOT EXISTS marketing_contacts (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT NOT NULL,
  name              TEXT,
  source            TEXT,                     -- ex: 'manual', 'import', 'landing'
  subscribed        BOOLEAN NOT NULL DEFAULT true,
  -- token do descadastro de 1 clique (LGPD + entregabilidade)
  unsubscribe_token TEXT NOT NULL,
  unsubscribed_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_contacts_email
  ON marketing_contacts (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_contacts_token
  ON marketing_contacts (unsubscribe_token);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id          BIGSERIAL PRIMARY KEY,
  subject     TEXT NOT NULL,
  title       TEXT NOT NULL,                 -- título dentro do e-mail
  body_text   TEXT NOT NULL,                 -- corpo em texto (quebras viram parágrafos)
  cta_label   TEXT,
  cta_url     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sending','done','failed')),
  total       INTEGER NOT NULL DEFAULT 0,
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);
