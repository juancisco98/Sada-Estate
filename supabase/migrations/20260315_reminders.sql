-- Tabla de recordatorios manuales para admins
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('property','tenant','professional','maintenance_task') OR entity_type IS NULL),
  entity_id TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para queries frecuentes
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON reminders(due_date);

-- RLS: solo admins tienen acceso
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to reminders" ON reminders;
CREATE POLICY "Admins full access to reminders"
  ON reminders FOR ALL
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)
  );

-- Habilitar realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reminders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
  END IF;
END $$;
