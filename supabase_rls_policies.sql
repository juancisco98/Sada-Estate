-- RLS Policies for Sada Estate
-- Run this in your Supabase SQL Editor

-- Enable RLS on tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Policy for 'properties'
-- Allow read/write access only to authenticated users whose email is in the allowed list (handled by app logic for now, or could be a table lookup)
-- For simplicity and standard security, we'll allow access to authenticated users. Application logic handles specific email allowlist.
-- Ideally, you'd have a 'profiles' table with a 'role' or 'is_allowed' column.
CREATE POLICY "Allow authenticated access to properties" ON properties
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for 'tenants'
CREATE POLICY "Allow authenticated access to tenants" ON tenants
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for 'tenant_payments'
CREATE POLICY "Allow authenticated access to tenant_payments" ON tenant_payments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for 'professionals'
CREATE POLICY "Allow authenticated access to professionals" ON professionals
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for 'maintenance_tasks'
CREATE POLICY "Allow authenticated access to maintenance_tasks" ON maintenance_tasks
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for 'buildings'
CREATE POLICY "Allow authenticated access to buildings" ON buildings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
