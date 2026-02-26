-- RLS Policies for Sada Estate
-- Run this in your Supabase SQL Editor
-- IMPORTANT: Run the full script. It drops old policies and creates secure ones.

-- ======================================================
-- Step 1: Create allowed_emails table for backend validation
-- ======================================================

CREATE TABLE IF NOT EXISTS allowed_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO allowed_emails (email) VALUES
    ('juan.sada98@gmail.com'),
    ('svsistemas@yahoo.com'),
    ('antovent64@gmail.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on allowed_emails" ON allowed_emails
    FOR SELECT TO authenticated USING (true);

-- ======================================================
-- Step 2: Enable RLS on data tables
-- ======================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- ======================================================
-- Step 3: Drop old permissive policies
-- ======================================================

DROP POLICY IF EXISTS "Allow authenticated access to properties" ON properties;
DROP POLICY IF EXISTS "Allow authenticated access to tenants" ON tenants;
DROP POLICY IF EXISTS "Allow authenticated access to tenant_payments" ON tenant_payments;
DROP POLICY IF EXISTS "Allow authenticated access to professionals" ON professionals;
DROP POLICY IF EXISTS "Allow authenticated access to maintenance_tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Allow authenticated access to buildings" ON buildings;

-- ======================================================
-- Step 4: Create email-validated policies
-- All 3 family emails share the same data.
-- Only users whose JWT email is in allowed_emails can access anything.
-- ======================================================

CREATE POLICY "Family access to properties" ON properties
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Family access to tenants" ON tenants
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Family access to tenant_payments" ON tenant_payments
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Family access to professionals" ON professionals
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Family access to maintenance_tasks" ON maintenance_tasks
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Family access to buildings" ON buildings
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));
