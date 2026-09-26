-- Ciclo de vida da reunião: status de verdade (antes nascia 'scheduled' e nunca
-- mudava), lembretes pro lead (24h/1h) e cutucada pós-reunião pro dono.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_nudge_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_note         TEXT NOT NULL DEFAULT '';

-- scheduled -> confirmed -> completed | no_show; cancelled a qualquer momento.
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','confirmed','completed','no_show','cancelled'));

-- Scans de lembrete/cutucada varrem por status + horário.
CREATE INDEX IF NOT EXISTS idx_appointments_status_when
  ON appointments (status, scheduled_at);
