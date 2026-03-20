-- RLS Policies for Sada Estate
-- Run this in your Supabase SQL Editor
-- IMPORTANT: Run the full script. It drops old policies and creates secure ones.

-- ======================================================
-- Step 1: Automatically drop ALL existing policies on relevant tables
-- This ensures no "Already exists" conflicts happen.
-- ======================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop policies from public tables
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('properties', 'tenants', 'tenant_payments', 'professionals', 'maintenance_tasks', 'buildings', 'allowed_emails')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;

    -- Drop policies from storage.objects
    FOR pol IN
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END
$$;

-- ======================================================
-- Step 2: Create allowed_emails table for backend validation
-- ======================================================

CREATE TABLE IF NOT EXISTS allowed_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure base emails are always there
INSERT INTO allowed_emails (email) VALUES
    ('juan.sada98@gmail.com'),
    ('svsistemas@yahoo.com'),
    ('antovent64@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- ======================================================
-- Step 3: Create email-validated policies
-- ======================================================

-- 3.1 Allowed Emails (Admin list)
CREATE POLICY "Allow authenticated read on allowed_emails" ON allowed_emails
    FOR SELECT TO authenticated USING (true);

-- 3.2 Properties
CREATE POLICY "Family access to properties" ON properties
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Tenant read access to assigned properties" ON properties
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT property_id 
            FROM tenants 
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    );

-- 3.3 Tenants
CREATE POLICY "Family access to tenants" ON tenants
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Tenant read access to own record" ON tenants
    FOR SELECT TO authenticated
    USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- 3.4 Tenant Payments
CREATE POLICY "Family access to tenant_payments" ON tenant_payments
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

CREATE POLICY "Tenant access to own payments" ON tenant_payments
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT id 
            FROM tenants 
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT id 
            FROM tenants 
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    );

-- 3.5 Professionals
CREATE POLICY "Family access to professionals" ON professionals
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- 3.6 Maintenance Tasks
CREATE POLICY "Family access to maintenance_tasks" ON maintenance_tasks
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- 3.7 Buildings
CREATE POLICY "Family access to buildings" ON buildings
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails))
    WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- ======================================================
-- Step 4: Storage bucket policies (payment-proofs)
-- ======================================================

CREATE POLICY "Allow authenticated read on payment-proofs" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'payment-proofs');

CREATE POLICY "Allow authenticated insert on payment-proofs" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow authenticated update on payment-proofs" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'payment-proofs');

CREATE POLICY "Allow authenticated delete on payment-proofs" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'payment-proofs');

