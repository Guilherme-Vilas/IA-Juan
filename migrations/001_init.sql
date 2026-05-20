CREATE TABLE IF NOT EXISTS leads (
  id          BIGSERIAL PRIMARY KEY,
  wa_id       TEXT NOT NULL UNIQUE,
  nome        TEXT,
  source      TEXT,
  state       TEXT NOT NULL DEFAULT 'S0_ABERTURA',
  slots       JSONB NOT NULL DEFAULT '{}'::jsonb,
  paused      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_state ON leads (state);
CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads (updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('in','out')),
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages (lead_id, created_at);

CREATE TABLE IF NOT EXISTS appointments (
  id                 BIGSERIAL PRIMARY KEY,
  lead_id            BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  calendar_event_id  TEXT NOT NULL,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'scheduled',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments (lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_when ON appointments (scheduled_at);
