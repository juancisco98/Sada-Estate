-- ══════════════════════════════════════════════════════════════════════
-- Fix: RLS policies case-insensitive para login de inquilinos
--
-- Problema: Todas las policies de tenant usaban comparación case-sensitive
-- (email = auth.jwt()->>'email'). Si el email almacenado tiene distinto
-- case que el JWT de Google, RLS bloquea la query y el inquilino no puede
-- ingresar aunque esté registrado.
--
-- Solución: Usar LOWER() en ambos lados de la comparación.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Normalizar emails existentes a minúsculas ────────────────────
UPDATE tenants SET email = LOWER(email) WHERE email IS DISTINCT FROM LOWER(email);

-- ── 2. Fix policy: Tenants can read own record ──────────────────────
DROP POLICY IF EXISTS "Tenant read access to own record" ON tenants;
CREATE POLICY "Tenant read access to own record" ON tenants
    FOR SELECT TO authenticated
    USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- ── 3. Fix policy: Tenants can read assigned properties ─────────────
DROP POLICY IF EXISTS "Tenant read access to assigned properties" ON properties;
CREATE POLICY "Tenant read access to assigned properties" ON properties
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT property_id
            FROM tenants
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    );

-- ── 4. Fix policy: Tenants can access own payments ──────────────────
DROP POLICY IF EXISTS "Tenant access to own payments" ON tenant_payments;
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

-- ── 5. Fix policy: Tenants can read own expense sheets ──────────────
DROP POLICY IF EXISTS "Tenants can read own expense_sheets" ON expense_sheets;
CREATE POLICY "Tenants can read own expense_sheets" ON expense_sheets
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT id
            FROM tenants
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    );

-- ── 6. Fix policy: Tenants can read own notifications ───────────────
-- (notifications usa recipient_email, no tenant_id)
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
