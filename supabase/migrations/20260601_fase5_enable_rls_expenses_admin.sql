-- ══════════════════════════════════════════════════════════════════════
-- Fase 5 — Endurecer RLS por rol + habilitar RLS en tablas core
--
-- HALLAZGO (verificado contra producción el 2026-06-01):
--   Las tablas core tenían RLS DESHABILITADO pese a tener policies definidas:
--     tenants, tenant_payments, properties, buildings,
--     professionals, maintenance_tasks  → relrowsecurity = false
--   Es decir: el aislamiento "el inquilino solo ve lo suyo" NO estaba
--   enforced a nivel base de datos — solo lo hacía el filtrado client-side.
--   Cualquier usuario autenticado podía leer/escribir TODA la data vía la API REST.
--
--   expense_sheets / notifications / expenses_admins SÍ tenían RLS on.
--
-- OBJETIVO:
--   1) Endurecer las policies de admin (familia) a case-insensitive (LOWER en
--      ambos lados) para evitar lockout del admin al habilitar RLS (Lección 9).
--   2) Agregar policies least-privilege para el rol EXPENSES_ADMIN (Nora):
--      lee tenants/properties/buildings; lee+actualiza tenant_payments (aprobar/
--      devolver); expense_sheets ya estaba cubierto. NO toca professionals ni
--      maintenance_tasks.
--   3) Habilitar RLS en las tablas core (el fix real).
--
-- ⚠️  APLICAR CON CUIDADO — toca el camino de admin EN USO REAL.
--     Ver checklist HITL en docs/fase-5-rls-checklist.md. Probar primero en una
--     Supabase preview branch con cuentas de prueba ADMIN / TENANT / EXPENSES_ADMIN
--     y confirmar que el admin NO pierde acceso antes de mergear a producción.
-- ══════════════════════════════════════════════════════════════════════

-- ── 0. Normalizar emails a minúsculas (defensivo) ───────────────────────
UPDATE allowed_emails  SET email = LOWER(email) WHERE email IS DISTINCT FROM LOWER(email);
UPDATE tenants         SET email = LOWER(email) WHERE email IS DISTINCT FROM LOWER(email);
UPDATE expenses_admins SET email = LOWER(email) WHERE email IS DISTINCT FROM LOWER(email);

-- ════════════════════════════════════════════════════════════════════════
-- 1. TENANTS
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to tenants" ON tenants;
CREATE POLICY "Family access to tenants" ON tenants
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

DROP POLICY IF EXISTS "Tenant read access to own record" ON tenants;
CREATE POLICY "Tenant read access to own record" ON tenants
    FOR SELECT TO authenticated
    USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- EXPENSES_ADMIN: solo lectura de inquilinos (para el CRM de expensas).
DROP POLICY IF EXISTS "Expenses admin read tenants" ON tenants;
CREATE POLICY "Expenses admin read tenants" ON tenants
    FOR SELECT TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE));

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 2. TENANT_PAYMENTS
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to tenant_payments" ON tenant_payments;
CREATE POLICY "Family access to tenant_payments" ON tenant_payments
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

DROP POLICY IF EXISTS "Tenant access to own payments" ON tenant_payments;
CREATE POLICY "Tenant access to own payments" ON tenant_payments
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')))
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')));

-- EXPENSES_ADMIN: leer pagos (ver estado) y actualizar (aprobar / devolver).
-- NO inserta ni borra pagos.
DROP POLICY IF EXISTS "Expenses admin read payments" ON tenant_payments;
CREATE POLICY "Expenses admin read payments" ON tenant_payments
    FOR SELECT TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE));

DROP POLICY IF EXISTS "Expenses admin update payments" ON tenant_payments;
CREATE POLICY "Expenses admin update payments" ON tenant_payments
    FOR UPDATE TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE));

ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 3. PROPERTIES
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to properties" ON properties;
CREATE POLICY "Family access to properties" ON properties
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

DROP POLICY IF EXISTS "Tenant read access to assigned properties" ON properties;
CREATE POLICY "Tenant read access to assigned properties" ON properties
    FOR SELECT TO authenticated
    USING (id IN (SELECT property_id FROM tenants WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')));

-- EXPENSES_ADMIN: solo lectura de propiedades (grid + unitLabel).
DROP POLICY IF EXISTS "Expenses admin read properties" ON properties;
CREATE POLICY "Expenses admin read properties" ON properties
    FOR SELECT TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE));

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 4. BUILDINGS
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to buildings" ON buildings;
CREATE POLICY "Family access to buildings" ON buildings
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

-- EXPENSES_ADMIN: lectura del edificio Vélez Sársfield (lookup del portal).
DROP POLICY IF EXISTS "Expenses admin read buildings" ON buildings;
CREATE POLICY "Expenses admin read buildings" ON buildings
    FOR SELECT TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE));

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 5. PROFESSIONALS — solo admin (ni inquilino ni Nora lo usan)
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to professionals" ON professionals;
CREATE POLICY "Family access to professionals" ON professionals
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 6. MAINTENANCE_TASKS — solo admin
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Family access to maintenance_tasks" ON maintenance_tasks;
CREATE POLICY "Family access to maintenance_tasks" ON maintenance_tasks
    FOR ALL TO authenticated
    USING (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails))
    WITH CHECK (LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM allowed_emails));

ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- ── Reload schema cache ─────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
