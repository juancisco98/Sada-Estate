-- Notifications table for payment status updates
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REVISION')),
  payment_id TEXT REFERENCES tenant_payments(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by recipient
CREATE INDEX IF NOT EXISTS notifications_recipient_email_idx ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (recipient_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users can mark own notifications as read" ON notifications;
CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (recipient_email = (auth.jwt() ->> 'email'))
  WITH CHECK (recipient_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ======================================================
-- Enable Supabase Realtime for tenant_payments and notifications
-- WITHOUT this, real-time subscriptions don't fire cross-session
-- ======================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tenant_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tenant_payments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
