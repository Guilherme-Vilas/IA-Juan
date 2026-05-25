CREATE TABLE IF NOT EXISTS campaigns (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp','linkedin')),
  template_text   TEXT NOT NULL,
  ai_refine       BOOLEAN NOT NULL DEFAULT true,
  tone            TEXT NOT NULL DEFAULT 'semi-formal',
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','running','paused','done')),
  rate_per_day    INTEGER NOT NULL DEFAULT 30,
  work_hours_only BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);

CREATE TABLE IF NOT EXISTS prospects (
  id                 BIGSERIAL PRIMARY KEY,
  campaign_id        BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  external_id        TEXT NOT NULL,
  nome               TEXT,
  empresa            TEXT,
  cargo              TEXT,
  raw_csv            JSONB NOT NULL DEFAULT '{}'::jsonb,
  composed_message   TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','replied','failed','skipped','ready_for_manual')),
  skip_reason        TEXT,
  sent_at            TIMESTAMPTZ,
  replied_at         TIMESTAMPTZ,
  lead_id            BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  error_msg          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_prospects_campaign_external
  ON prospects (campaign_id, external_id);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects (status);
CREATE INDEX IF NOT EXISTS idx_prospects_external ON prospects (external_id);

CREATE TABLE IF NOT EXISTS prospect_events (
  id           BIGSERIAL PRIMARY KEY,
  prospect_id  BIGINT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_events_prospect ON prospect_events (prospect_id, created_at);
