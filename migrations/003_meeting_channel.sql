ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS meeting_channel TEXT
    CHECK (meeting_channel IS NULL OR meeting_channel IN ('ligacao', 'video'));
