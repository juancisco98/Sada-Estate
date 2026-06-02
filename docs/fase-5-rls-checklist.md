# Fase 5 — Checklist de verificación HITL (portales + RLS)

Este documento acompaña la migración `supabase/migrations/20260601_fase5_enable_rls_expenses_admin.sql`.
La verificación de RLS por rol y el flujo extremo a extremo **requieren cuentas de prueba reales** (HITL).

---

## 🔴 Hallazgo de seguridad (verificado contra producción, 2026-06-01)

Las tablas core tenían **RLS deshabilitado** pese a tener policies definidas:

| Tabla | RLS antes | RLS después de la migración |
|---|---|---|
| `tenants` | ❌ off | ✅ on |
| `tenant_payments` | ❌ off | ✅ on |
| `properties` | ❌ off | ✅ on |
| `buildings` | ❌ off | ✅ on |
| `professionals` | ❌ off | ✅ on |
| `maintenance_tasks` | ❌ off | ✅ on |
| `expense_sheets` | ✅ on | ✅ on (sin cambios) |
| `notifications` | ✅ on | ✅ on (sin cambios) |
| `expenses_admins` | ✅ on | ✅ on (sin cambios) |

**Implicancia:** hasta aplicar la migración, el aislamiento "el inquilino solo ve lo suyo"
**no está enforced a nivel base de datos** — solo lo hace el filtrado client-side. Un usuario
autenticado (inquilino o Nora) podría leer/escribir datos de otros vía la API REST directa.

La migración también endurece las policies de admin a **case-insensitive** (`LOWER()` en ambos
lados) para evitar que un admin quede bloqueado al activar RLS (Lección 9).

---

## ⚠️ Cómo aplicar de forma segura

1. **Probar en una Supabase preview branch primero** (no directo en producción):
   - Crear branch → aplicar la migración → correr el test matrix de abajo.
2. Confirmar que **el ADMIN no pierde acceso** (es el camino en uso real).
3. Recién entonces mergear la branch a producción.
4. Tras aplicar, correr el security advisor de Supabase y confirmar 0 tablas con
   "RLS disabled in public".

---

## ✅ Test matrix por rol (con cuentas de prueba)

### ADMIN (email en `allowed_emails`)
- [ ] Login entra al panel de admin completo.
- [ ] Ve y edita propiedades, inquilinos, pagos, profesionales, mantenimiento.
- [ ] Crea/edita/borra un pago y un inquilino sin error de permisos.

### TENANT (email en `tenants`, NO en `allowed_emails`)
- [ ] Login entra al **TenantPortal** (no al admin).
- [ ] Ve **solo sus** pagos y liquidaciones (grilla del año).
- [ ] **Prueba de aislamiento (API):** con su sesión, una query directa a
      `tenant_payments`/`tenants` de **otro** inquilino devuelve **0 filas** (no error, vacío).
- [ ] Sube un comprobante → el mes pasa a **REVISIÓN**.
- [ ] Recibe notificación cuando el admin/Nora aprueba o devuelve.

### EXPENSES_ADMIN (email en `expenses_admins`, `active = true`, NO en `allowed_emails`)
- [ ] Login entra al **ExpensesAdminPortal** (no al admin, no al tenant).
- [ ] Ve el grid de inquilinos de **Vélez Sársfield 134**.
- [ ] Abre el detalle de un inquilino: ve liquidaciones y comprobantes.
- [ ] **Sube** una liquidación (Excel y PDF) → se guarda (`expense_sheets`).
- [ ] **Aprueba** un pago en revisión → estado pasa a APPROVED, inquilino notificado.
- [ ] **Devuelve** un pago con motivo → estado RETURNED, inquilino notificado.
- [ ] **Prueba de least-privilege:** NO puede crear/borrar propiedades, profesionales
      ni tareas de mantenimiento (esas tablas solo permiten admin).

---

## ✅ Flujo PENDING → REVISION → APPROVED (extremo a extremo)

- [ ] Mes sin pago → estado **PENDING** (gris) en el TenantPortal.
- [ ] Inquilino sube comprobante de expensas + monto → **REVISION** (ámbar, reloj).
- [ ] Admin/Nora ve el pago en "pendientes de revisión".
- [ ] Nora **aprueba** → **APPROVED** (verde) en el portal del inquilino + notificación.
- [ ] (Alternativo) Nora **devuelve** con motivo → **RETURNED** (corregir) + notificación;
      el inquilino puede re-subir.

---

## ✅ Estados loading / empty / error (verificación visual)

- [ ] TenantPortal: spinner "Cargando tu información…" mientras cargan los datos.
- [ ] TenantPortal: dropdown de notificaciones muestra "Sin notificaciones" cuando no hay.
- [ ] ExpensesAdminPortal: grid muestra "Sin inquilinos registrados" si el edificio no tiene.
- [ ] UploadReceiptModal: botón "Excel" muestra spinner mientras descarga; errores via toast.
- [ ] Todo error de Supabase muestra `toast.error` (ningún modal cierra en silencio).

---

## ✅ Accesibilidad básica (spot-check)

- [ ] Botones solo-ícono tienen `aria-label` (campana, logout, cerrar, navegación de año, volver).
- [ ] Inputs tienen label asociado (monto, motivo de devolución).
- [ ] Contraste legible en dark mode (textos "Pendiente" / mensajes de notificación).
- [ ] Navegación por teclado: foco visible en links y botones.

---

## Notas de implementación (lado código — ya en este PR)

- `TenantPortal`: query de notificaciones `.eq` → `.ilike` (case-insensitive, Lección 9);
  loading state; `aria-label` en campana/logout; contraste del estado "Pendiente".
- `UploadReceiptModal`: loading state en descarga Excel; `accept` restringido a imagen/PDF;
  `aria-label`/`htmlFor` en cerrar y monto.
- `ExpensesAdminPortal`: `aria-label` en campana; contraste de notificaciones; inserts de
  notificación normalizados a array `[{...}]`.
- `ExpensesTenantDetail`: `aria-label` en volver, navegación de año, cerrar modales y motivo.
