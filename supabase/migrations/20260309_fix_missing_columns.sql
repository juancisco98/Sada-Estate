-- Sada Estate: Add missing columns to tenant_payments
-- Root cause: PGRST204 error — payment_method and other columns missing from DB schema
-- All additions use IF NOT EXISTS guards (safe to re-run)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='payment_method') THEN
        ALTER TABLE tenant_payments ADD COLUMN payment_method TEXT DEFAULT 'TRANSFER';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='currency') THEN
        ALTER TABLE tenant_payments ADD COLUMN currency TEXT DEFAULT 'ARS';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='paid_on_time') THEN
        ALTER TABLE tenant_payments ADD COLUMN paid_on_time BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='property_id') THEN
        ALTER TABLE tenant_payments ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='user_id') THEN
        ALTER TABLE tenant_payments ADD COLUMN user_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='proof_of_payment') THEN
        ALTER TABLE tenant_payments ADD COLUMN proof_of_payment TEXT;
    END IF;
END $$;

-- Reload PostgREST schema cache so new columns are recognized immediately
NOTIFY pgrst, 'reload schema';

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

-- Allow public read
DROP POLICY IF EXISTS "Public read payment proofs" ON storage.objects;
CREATE POLICY "Public read payment proofs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-proofs');
