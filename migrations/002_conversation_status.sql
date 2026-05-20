ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  ADD COLUMN IF NOT EXISTS closed_reason  TEXT
    CHECK (closed_reason IS NULL OR closed_reason IN (
      'scheduled','not_interested','postponed','handoff','no_response'
    )),
  ADD COLUMN IF NOT EXISTS closed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_user_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_assistant_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);

UPDATE leads SET status = 'closed', closed_reason = 'scheduled', closed_at = now()
  WHERE state = 'S5_CONFIRMADO' AND closed_at IS NULL;

UPDATE leads SET status = 'closed', closed_reason = 'handoff', closed_at = now()
  WHERE state = 'HANDOFF' AND closed_at IS NULL;
