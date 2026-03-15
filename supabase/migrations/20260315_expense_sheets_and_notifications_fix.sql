-- Sada Estate: Create expense_sheets table + fix notifications + link properties to building
-- Fixes 4 issues:
--   1. expense_sheets table missing → admin uploads fail silently
--   2. notifications CHECK constraint missing PAYMENT_RETURNED → return notifications fail
--   3. expense_amount column might be missing in tenant_payments
--   4. Properties not linked to building → ExpensesAdminPortal shows 0 tenants

-- ══════════════════════════════════════════════════════════════════════
-- 1. Create expense_sheets table
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expense_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  sheet_data JSONB NOT NULL DEFAULT '[]',
  sheet_name TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, month, year)
);

-- Indices
CREATE INDEX IF NOT EXISTS expense_sheets_tenant_idx ON expense_sheets(tenant_id);
CREATE INDEX IF NOT EXISTS expense_sheets_period_idx ON expense_sheets(month, year);

-- RLS
ALTER TABLE expense_sheets ENABLE ROW LEVEL SECURITY;

-- Admins: acceso total
DROP POLICY IF EXISTS "Admins can manage expense_sheets" ON expense_sheets;
CREATE POLICY "Admins can manage expense_sheets"
  ON expense_sheets FOR ALL
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- Tenants: solo leer sus propias hojas
DROP POLICY IF EXISTS "Tenants can read own expense_sheets" ON expense_sheets;
CREATE POLICY "Tenants can read own expense_sheets"
  ON expense_sheets FOR SELECT
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE email = (auth.jwt() ->> 'email')
  ));

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'expense_sheets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expense_sheets;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Fix notifications CHECK constraint: add PAYMENT_RETURNED
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- The original constraint name might differ, try the generic column check name too
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'notifications'
    AND a.attname = 'type'
    AND c.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REVISION', 'PAYMENT_RETURNED'));

-- ══════════════════════════════════════════════════════════════════════
-- 3. Add expense_amount to tenant_payments if missing
-- ══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='tenant_payments' AND column_name='expense_amount') THEN
        ALTER TABLE tenant_payments ADD COLUMN expense_amount NUMERIC DEFAULT 0;
    END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Link Vélez Sársfield properties to their building record
--    The building exists (bld-velez-sarsfield-134) but properties have
--    building_id = NULL. The Overview groups by address fallback, but
--    ExpensesAdminPortal filters strictly by buildingId.
-- ══════════════════════════════════════════════════════════════════════

UPDATE properties
SET
  property_type = 'edificio',
  building_id = 'bld-velez-sarsfield-134'
WHERE building_id IS NULL
  AND (
    LOWER(REPLACE(REPLACE(address, 'é', 'e'), 'á', 'a')) LIKE '%velez sarsfield%'
    OR LOWER(address) LIKE '%vélez sársfield%'
    OR LOWER(address) LIKE '%vélez sarsfield%'
    OR LOWER(address) LIKE '%velez sársfield%'
    OR address LIKE '134, Vélez Sarsfield%'
    OR address LIKE '134, Velez Sarsfield%'
    OR address LIKE '134, V_lez Sarsfield%'
  );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
