-- Sada Estate: Fix tenant_payments schema and storage bucket
-- Purpose: Add missing columns for notes, status and proof of expenses
-- Purpose 2: Ensure the storage bucket exists for uploads

-- 1. Add missing columns to tenant_payments if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='notes') THEN
        ALTER TABLE tenant_payments ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='status') THEN
        ALTER TABLE tenant_payments ADD COLUMN status TEXT DEFAULT 'APPROVED';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant_payments' AND column_name='proof_of_expenses') THEN
        ALTER TABLE tenant_payments ADD COLUMN proof_of_expenses TEXT;
    END IF;
END $$;

-- 2. Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Verify status values
UPDATE tenant_payments SET status = 'APPROVED' WHERE status IS NULL;
