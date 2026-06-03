-- Permitir que EXPENSES_ADMIN (Nora) edite el nombre del inquilino y el
-- departamento (unit_label), para asignar a cada inquilino su nombre y depto
-- correcto desde el portal de expensas.
--
-- Contexto: Fase 5 (20260601) dejo a EXPENSES_ADMIN con SOLO LECTURA sobre
-- tenants y properties. Sin UPDATE, el boton de editar falla en silencio:
-- RLS no tira error en un UPDATE bloqueado, simplemente afecta 0 filas.
--
-- Objetivo (least-privilege): agregar policies de UPDATE para EXPENSES_ADMIN
-- sobre tenants y properties, ESCOPADAS solo al edificio Velez Sarsfield 134
-- (building_id = 'bld-velez-sarsfield-134'). Nora no puede tocar otro edificio.
-- Las policies existentes (familia / inquilino) no se modifican.
--
-- Nota: RLS restringe QUE filas, no QUE columnas. La UI solo edita name y
-- unit_label; el limite duro es el edificio. Suficiente para uso familiar.
--
-- RLS ya esta habilitado en ambas tablas (no se re-habilita aca).

-- TENANTS: EXPENSES_ADMIN puede actualizar inquilinos del edificio Velez
DROP POLICY IF EXISTS "Expenses admin update tenants" ON tenants;
CREATE POLICY "Expenses admin update tenants" ON tenants
    FOR UPDATE TO authenticated
    USING (
        LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE)
        AND property_id IN (SELECT id FROM properties WHERE building_id = 'bld-velez-sarsfield-134')
    )
    WITH CHECK (
        LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE)
        AND property_id IN (SELECT id FROM properties WHERE building_id = 'bld-velez-sarsfield-134')
    );

-- PROPERTIES: EXPENSES_ADMIN puede actualizar properties del edificio Velez
DROP POLICY IF EXISTS "Expenses admin update properties" ON properties;
CREATE POLICY "Expenses admin update properties" ON properties
    FOR UPDATE TO authenticated
    USING (
        LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE)
        AND building_id = 'bld-velez-sarsfield-134'
    )
    WITH CHECK (
        LOWER(auth.jwt() ->> 'email') IN (SELECT LOWER(email) FROM expenses_admins WHERE active IS TRUE)
        AND building_id = 'bld-velez-sarsfield-134'
    );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
