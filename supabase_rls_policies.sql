-- RLS Policies for Sada Estate
-- Run this in your Supabase SQL Editor

-- Enable RLS on tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Note: In a production environment, you should bridge the 'auth.users' table
-- with a public 'profiles' table to enforce email-based access in SQL.
-- Example: USING (auth.jwt() ->> 'email' IN (SELECT email FROM allowed_profiles))

-- Policy for 'properties'
CREATE POLICY "Allow authenticated access to properties" ON properties
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for 'tenants'
CREATE POLICY "Allow authenticated access to tenants" ON tenants
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for 'tenant_payments'
CREATE POLICY "Allow authenticated access to tenant_payments" ON tenant_payments
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for 'professionals'
CREATE POLICY "Allow authenticated access to professionals" ON professionals
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for 'maintenance_tasks'
CREATE POLICY "Allow authenticated access to maintenance_tasks" ON maintenance_tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for 'buildings'
CREATE POLICY "Allow authenticated access to buildings" ON buildings
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
