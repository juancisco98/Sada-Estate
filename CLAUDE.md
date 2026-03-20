# CLAUDE.md — Sada Estate

Archivo de instrucciones persistentes para Claude Code. Documenta el proyecto, convenciones técnicas y lecciones aprendidas de debugging real. Claude debe consultar este archivo al iniciar cada sesión y actualizarlo cuando aprenda algo nuevo.

---

## Contexto del Proyecto

**¿Qué hace la app?**
Sada Estate es una aplicación de gestión de propiedades en alquiler para uso familiar (familia Sada). Permite:
- Ver propiedades y edificios en un mapa interactivo (Buenos Aires, Argentina)
- Gestionar inquilinos, contratos y pagos mensuales
- Trackear gastos de mantenimiento y profesionales asignados
- Portal exclusivo para inquilinos donde pueden subir comprobantes de pago
- Aprobación de comprobantes por parte del admin con flujo PENDING → REVISION → APPROVED

**Tres sesiones de usuario:**
- **ADMIN**: Emails en `allowed_emails` table (juan.sada98@gmail.com, svsistemas@yahoo.com, antovent64@gmail.com). Acceso total.
- **EXPENSES_ADMIN**: Emails en `expenses_admins` table (ej: Nora). Solo ve el portal de gestión de expensas (`ExpensesAdminPortal.tsx`).
- **TENANT**: Cualquier email registrado en la tabla `tenants`. Solo ve su portal de pagos (`TenantPortal.tsx`).

**Stack técnico:**
| Capa | Tecnología |
|---|---|
| Framework | React 19.2 + TypeScript 5.8 + Vite 6 |
| Estilos | TailwindCSS (class-based dark mode) |
| Backend | Supabase (PostgreSQL + Storage + Realtime + Auth) |
| Íconos | Lucide React |
| Notificaciones | Sonner (toasts) |
| Gráficos | Recharts |
| Mapas | Leaflet + React-Leaflet |
| Mobile | Capacitor (Android PWA) |
| Auth | Google OAuth2 (PKCE flow) |

---

## Arquitectura

### Flujo de datos
```
Supabase DB
    ↕ (real-time postgres_changes channel)
DataContext.tsx  ← fuente única de verdad para toda la app
    ↕
Custom Hooks (useProperties, useTenantData, useMaintenance, etc.)
    ↕ (data + handlers)
Componentes UI (TenantsView, TenantPortal, DashboardViews, etc.)
```

### Archivos críticos
| Archivo | Responsabilidad |
|---|---|
| `context/DataContext.tsx` | Estado global, real-time Supabase, `refreshData()` |
| `utils/mappers.ts` | Conversión DB (snake_case) ↔ App (camelCase) |
| `utils/supabaseHelpers.ts` | CRUD genérico: `supabaseUpsert`, `supabaseInsert`, `supabaseUpdate`, `supabaseDelete` |
| `services/supabaseClient.ts` | Cliente Supabase, auth, `signOut()` |
| `services/storage.ts` | Upload de archivos al bucket `payment-proofs` |
| `types.ts` | Todas las interfaces TypeScript de la app |
| `types/dbRows.ts` | Tipos de las filas de DB (snake_case) |
| `constants.ts` | `ALLOWED_EMAILS`, `MONTH_NAMES`, `MAP_CENTER`, etc. |
| `components/ExpensesAdminPortal.tsx` | Portal CRM para admin de expensas (Nora) |
| `components/expenses/ExpensesTenantDetail.tsx` | Vista detalle inquilino en admin expensas |
| `components/UploadReceiptModal.tsx` | Modal inquilino: ver liquidación + subir comprobante |

### Tablas Supabase
- `allowed_emails` — whitelist de admins
- `properties` — inmuebles
- `buildings` — edificios (agrupan units)
- `tenants` — inquilinos
- `tenant_payments` — pagos mensuales (id: UUID, status: PENDING|REVISION|APPROVED)
- `professionals` — profesionales de mantenimiento
- `maintenance_tasks` — tareas de mantenimiento
- `expense_sheets` — hojas de liquidación de expensas (sheet_data: JSONB con filas del Excel)
- `expenses_admins` — whitelist de admins de expensas (Nora)
- `notifications` — notificaciones para admins e inquilinos

### RLS (Row Level Security)
- Admins: acceso total via subquery `(auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)`
- Tenants: solo ven registros donde su email aparece en la tabla `tenants`

### Estado de pagos
```
PENDING → (inquilino sube comprobantes) → REVISION → (admin aprueba) → APPROVED
```
- `PENDING`: sin registro de pago
- `REVISION`: inquilino subió comprobantes, esperando revisión admin
- `APPROVED`: admin verificó y aprobó

---

## Guía de Estilo y Convenciones

### IDs — CRÍTICO
- **NUNCA** usar `Date.now()`, `Math.random()` o strings con prefijos (`pay-123`, `ten-456`) como ID primario en Supabase.
- **SIEMPRE** generar UUIDs válidos con la función `generateUUID()`:
```typescript
const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
```
- **Por qué**: `crypto.randomUUID()` falla/cuelga en entornos HTTP sin TLS (desarrollo local). Usar siempre el generador manual.

### Dark mode
- Usar siempre el prefijo `dark:` de Tailwind para todos los componentes.
- Fondo oscuro: `dark:bg-slate-950` (páginas), `dark:bg-slate-900` (modales/cards).
- Bordes oscuros: `dark:border-white/10`.
- Texto oscuro: `dark:text-white`, `dark:text-slate-300`, `dark:text-slate-400`.
- El toggle de dark mode agrega/quita la clase `dark` en `<html>` via `ThemeContext`.

### Modales con scroll (patrón obligatorio)
Cualquier modal que pueda superar el alto de pantalla DEBE usar:
```tsx
// Container del modal
className="... flex flex-col max-h-[90vh]"
// Header del modal
className="... shrink-0"
// Body del modal (scrolleable)
className="... overflow-y-auto"
// Footer del modal
className="... shrink-0"
```

### Colores de estado — semántica obligatoria
| Estado | Color Tailwind |
|---|---|
| APPROVED / Pagado / CURRENT | `green` / `emerald` |
| REVISION / WARNING / En revisión | `amber` / `yellow` |
| LATE / Error / Eliminado | `red` / `rose` |
| PENDING / Vacante / Sin datos | `gray` / `slate` |
| Acción primaria / Seleccionado | `indigo` / `violet` |

### Nombre del inquilino
- **SIEMPRE**: `property.tenantName`
- **NUNCA**: `getPropertyDisplayInfo(property).title` para el campo INQUILINO
- **Por qué**: `getPropertyDisplayInfo().title` retorna la dirección de la calle para casas independientes, no el nombre del inquilino.

### Error handling en Supabase
- **SIEMPRE** mostrar un `toast.error()` con el mensaje de error en los catch blocks.
- **NUNCA** cerrar modales silenciosamente sin informar al usuario qué falló.
```typescript
// ✅ Correcto
} catch (error: any) {
    toast.error(`Error: ${error?.message || 'Error desconocido'}`);
    // No cerrar el modal — dejar al usuario reintentar
}
// ❌ Incorrecto
} catch {
    setShowModal(false); // cierre silencioso sin feedback
}
```

### Mappers DB ↔ App
- Toda conversión de datos entre Supabase y el estado de la app pasa por `utils/mappers.ts`.
- Nomenclatura: `dbToX()` para DB→App, `XToDb()` para App→DB.
- Los tipos de DB viven en `types/dbRows.ts` (snake_case).
- Los tipos de la app viven en `types.ts` (camelCase).

### Emails — normalización obligatoria
- Al guardar emails en Supabase: `email.trim().toLowerCase()`
- Al comparar emails en queries JS: usar `.ilike('email', x)` NUNCA `.eq('email', x)`
- En RLS policies de PostgreSQL: `LOWER(email) = LOWER(auth.jwt() ->> 'email')`
- **Por qué**: Google OAuth devuelve emails en minúsculas. Si el email almacenado tiene mayúsculas, la comparación case-sensitive falla silenciosamente.

### Queries con `.maybeSingle()` — CRÍTICO
- **SIEMPRE** agregar `.limit(1)` antes de `.maybeSingle()`: `.ilike('email', x).limit(1).maybeSingle()`
- **Por qué**: Si hay filas duplicadas, `.maybeSingle()` devuelve error `PGRST116` ("Results contain N rows") en vez de `null`. Esto causa "Acceso denegado" falso.
- Al ver error `PGRST116` en consola → buscar filas duplicadas inmediatamente.

### Datos de Excel — NUNCA hardcodear índices
- **NUNCA** usar `sheetData[8]` o `sheetData.slice(N)` para extraer datos de un Excel.
- **SIEMPRE** buscar dinámicamente: buscar fila que contiene "TOTAL" para el total, y mostrar TODAS las filas al usuario.
- **Por qué**: Cada archivo Excel puede tener un formato diferente. Hardcodear rompe cuando el formato cambia.

### Logging en flujos críticos
- Para **autenticación** y flujos de login: usar `console.log/error/warn` directo, NO `logger`.
- **Por qué**: `logger` (en `utils/logger.ts`) solo imprime cuando `import.meta.env.DEV === true`. En producción (Vercel), los logs son silenciados y no se puede diagnosticar problemas.

### Herramienta Write vs Edit
- **SIEMPRE** usar el tool `Read` antes de `Write` o `Edit` en un archivo existente.
- Preferir `Edit` (diff parcial) sobre `Write` (reescritura completa) para archivos existentes.

---

## Lecciones Aprendidas (Improvement Loop)

Esta sección se actualiza automáticamente cuando Claude comete un error que el usuario debe corregir. Cada entrada incluye: qué pasó, por qué ocurrió, y la regla derivada.

---

### Lección 1 — UUID inválido causa fallo silencioso en Supabase
**Qué pasó:** El modal `UploadReceiptModal` usaba `id: \`pay-${Date.now()}\`` como ID del pago. Supabase rechazaba el `upsert` porque la columna `id` es de tipo `uuid`. El catch block cerraba el modal silenciosamente y el pago nunca se guardaba. El mismo error existía en `TenantsView.tsx`.

**Causa raíz:** `crypto.randomUUID()` fue reemplazado con `Date.now()` para evitar un cuelgue en HTTP local. Pero `Date.now()` no es un UUID válido.

**Regla derivada:** Usar siempre `generateUUID()` (función manual). Agregar esta función en cualquier componente que cree registros con ID. Ver función en sección "Guía de Estilo → IDs".

**Archivos afectados:** `components/UploadReceiptModal.tsx`, `components/TenantsView.tsx`

---

### Lección 2 — `getPropertyDisplayInfo().title` no es el nombre del inquilino
**Qué pasó:** En `DashboardViews.tsx` se usó `getPropertyDisplayInfo(property).title` para mostrar el nombre del inquilino en la tarjeta de propiedad. Para edificios funciona (muestra el label de unidad + inquilino), pero para casas independientes retorna la dirección de la calle (ej: "Vélez Sársfield 134"), mostrando el número de dirección en vez del nombre.

**Causa raíz:** `getPropertyDisplayInfo()` es una función de display para títulos de tarjetas, no para obtener el inquilino específicamente.

**Regla derivada:** Para mostrar el nombre del inquilino en cualquier campo "INQUILINO", siempre usar `property.tenantName` directamente.

**Archivos afectados:** `components/DashboardViews.tsx`, `components/PropertyCard.tsx`

---

### Lección 3 — Modales sin constrainst de altura se cortan en móvil
**Qué pasó:** El modal "Registrar Pago" en `TenantsView.tsx` tenía `overflow-hidden` pero sin `max-h`. En pantallas móviles el contenido del modal (muchos campos) superaba la altura visible y los campos del fondo quedaban inaccesibles.

**Causa raíz:** El modal usaba `overflow-hidden` para recortar bordes redondeados, sin considerar el comportamiento en pantallas pequeñas.

**Regla derivada:** Todo modal con más de 4-5 campos DEBE usar el patrón `flex flex-col max-h-[90vh]` + body con `overflow-y-auto` + header/footer con `shrink-0`. Ver patrón completo en sección "Guía de Estilo → Modales".

**Archivos afectados:** `components/TenantsView.tsx`

---

### Lección 4 — Pagos en REVISION pintados de verde (igual que APPROVED)
**Qué pasó:** En `getTenantMetrics` (hook `useTenantData.ts`), `monthlyBreakdown` calculaba `paid: monthPayments.length > 0`. Esto marcaba pagos en REVISION como "pagados", haciendo que el grid mensual mostrara un checkmark verde en vez del reloj ámbar. El admin no podía distinguir visualmente cuáles meses necesitaban revisión.

**Causa raíz:** La lógica de `paid` solo verificaba si existía algún pago, sin considerar el `status` del mismo.

**Regla derivada:** El campo `paid` en monthlyBreakdown debe usar `monthPayments.some(p => p.status === 'APPROVED')`, no `monthPayments.length > 0`. Para la UI siempre verificar el `status` del pago antes de decidir el color/ícono. REVISION → ámbar + Clock. APPROVED → verde + CheckCircle.

**Estado:** Corregido en auditoría del 2026-03-15.

**Archivos afectados:** `hooks/useTenantData.ts`, `components/TenantsView.tsx`

---

### Lección 5 — Fallos de Supabase cerrados silenciosamente sin toast de error
**Qué pasó:** En `UploadReceiptModal.handleConfirmSubmit`, el catch block llamaba `setShowConfirm(false)` y retornaba al formulario sin mostrar ningún mensaje de error. El usuario solo veía que el spinner desaparecía y volvía al formulario, sin saber qué había fallado.

**Causa raíz:** El catch block priorizaba "limpiar estado UI" sobre "informar al usuario". El `toast.error()` existía en el código pero no se ejecutaba visiblemente por un problema de orden de operaciones.

**Regla derivada:** En todo catch block de operaciones Supabase, el `toast.error()` debe ser la primera instrucción, antes de cualquier cambio de estado UI. Nunca cerrar un modal en el catch si el error no fue resuelto — dejar al usuario reintentar.

**Archivos afectados:** `components/UploadReceiptModal.tsx`

---

### Lección 6 — IDs de edificio y propiedad usan Date.now() en vez de generateUUID()
**Qué pasó:** `AddPropertyModal.tsx` generaba IDs inválidos: `bld-${Date.now()}` para edificios, `${Date.now()}-u${idx}` para unidades, y `Date.now().toString()` para propiedades standalone. Ninguno es un UUID válido, causando fallos silenciosos en Supabase si la columna es tipo `uuid`.

**Causa raíz:** `generateUUID()` no estaba definida ni importada en `AddPropertyModal.tsx`. Se usó `Date.now()` como atajo, repitiendo exactamente el error de la Lección 1.

**Regla derivada:** Todo archivo que cree registros con ID para Supabase DEBE definir o importar `generateUUID()`. Antes de cada merge, buscar `Date.now()` usado como ID con `grep -r "Date.now()" --include="*.tsx" --include="*.ts"` y verificar que no se usa como ID de BD.

**Archivos afectados:** `components/AddPropertyModal.tsx`, `hooks/useReminders.ts`

---

### Lección 7 — Registro de edificio nunca se crea en tabla buildings
**Qué pasó:** Al crear un edificio con unidades, `AddPropertyModal` generaba un `buildingId` y lo asignaba a cada propiedad, pero nunca llamaba `saveBuilding()` para crear el registro en la tabla `buildings`. El edificio no aparecía en `DataContext.buildings` y el mapa no lo reconocía como edificio real.

**Causa raíz:** El flujo de creación de edificio solo operaba a nivel de propiedades. Se asumió que el edificio se inferiría automáticamente de las propiedades, pero `DataContext` carga edificios desde la tabla `buildings` explícitamente.

**Regla derivada:** Siempre que se creen propiedades con `buildingId`, también crear el registro del edificio en la tabla `buildings` via `saveBuilding()`. El building record debe incluir: id, address, coordinates, country, currency.

**Archivos afectados:** `App.tsx` (`handleSaveProperty`)

---

### Lección 8 — No se puede agregar unidades a edificio existente
**Qué pasó:** Una vez creado el edificio, no había forma de agregarle nuevas unidades. `BuildingUnitManager` se oculta en modo edición (`isEditing`), y `BuildingCard` no tenía acción de "agregar unidad". Los administradores tenían que recrear el edificio completo para sumar un departamento.

**Causa raíz:** El diseño original solo contempló la creación inicial del edificio con todas sus unidades, sin considerar el crecimiento posterior (ej: nuevos departamentos, subdivisiones).

**Regla derivada:** Toda entidad que agrupa sub-entidades (edificio→unidades, profesional→tareas) debe ofrecer una acción para agregar sub-entidades desde la vista de detalle de la entidad padre. Usar una prop como `targetBuilding` para pre-configurar el modal de creación.

**Archivos afectados:** `components/BuildingCard.tsx`, `components/AddPropertyModal.tsx`, `App.tsx`

---

### Lección 9 — RLS policies case-sensitive bloquean login de inquilinos
**Qué pasó:** `sadajuan98@gmail.com` estaba registrado como inquilino pero recibía "Acceso denegado" al intentar ingresar. El diagnóstico tomó varios intentos porque los logs no aparecían en producción.

**Causa raíz:** TODAS las RLS policies de PostgreSQL usaban `email = (auth.jwt() ->> 'email')`, que es comparación case-sensitive. Google OAuth devuelve el email normalizado a minúsculas. Si el email en la BD tenía alguna mayúscula diferente, RLS bloqueaba la lectura y la query devolvía `null` — indistinguible de "no existe".

**Regla derivada:** Toda RLS policy que compare emails DEBE usar `LOWER()` en ambos lados. Toda query JS que busque por email DEBE usar `.ilike()`. Al dar de alta inquilinos, normalizar: `email.trim().toLowerCase()`. Ver convención "Emails" en Guía de Estilo.

**Archivos afectados:** `supabase/migrations/`, `supabase_rls_policies.sql`, `App.tsx`, `components/TenantsView.tsx`, `utils/mappers.ts`

---

### Lección 10 — `.maybeSingle()` falla con PGRST116 si hay filas duplicadas
**Qué pasó:** Aun después de corregir RLS, el login seguía fallando. La consola mostraba `PGRST116: "Results contain 2 rows"`. Había 2 registros de `sadajuan98@gmail.com` en `tenants`. `.maybeSingle()` de Supabase falla si encuentra más de 1 fila.

**Causa raíz:** No hay constraint UNIQUE en `tenants.email`. El flujo de alta no verificaba duplicados. `.maybeSingle()` sin `.limit(1)` estalla con cualquier duplicado.

**Regla derivada:** SIEMPRE usar `.limit(1)` antes de `.maybeSingle()`. Al ver error PGRST116 en consola, buscar filas duplicadas en la tabla afectada. Ver convención "Queries con `.maybeSingle()`" en Guía de Estilo.

**Archivos afectados:** `App.tsx`

---

### Lección 11 — `logger` no imprime en producción (Vercel)
**Qué pasó:** Al debuggear el login fallido en producción, la consola del navegador estaba completamente vacía. Se perdieron varias horas sin diagnóstico porque no había output visible.

**Causa raíz:** El flujo de auth usaba `logger.log()` / `logger.error()` de `utils/logger.ts`, que internamente chequea `import.meta.env.DEV`. En Vercel, `DEV` es `false`, así que todos los logs eran silenciados.

**Regla derivada:** Para flujos críticos (auth, login, pagos), usar `console.log/error/warn` directo, NUNCA `logger`. Al debuggear problemas en producción, lo primero es verificar si los logs están siendo silenciados. Ver convención "Logging en flujos críticos" en Guía de Estilo.

**Archivos afectados:** `App.tsx`, `utils/logger.ts`

---

### Lección 12 — Hardcodear índices de fila en datos de Excel rompe con formatos diferentes
**Qué pasó:** El modal del inquilino mostraba "Liquidación de expensas" con botón Descargar, pero sin tabla de desglose ni total. El inquilino no podía ver qué le estaban cobrando.

**Causa raíz:** El código usaba `sheetData[8]` para el total y `sheetData.slice(8)` para los conceptos, basándose en UN formato específico de Excel. Cuando Nora subió un archivo con estructura diferente (menos filas o total en otra posición), `sheetData[8]` era `undefined` y `slice(8)` devolvía `[]`.

**Regla derivada:** NUNCA hardcodear índices de fila para datos de Excel. Buscar el total dinámicamente (fila que contiene "TOTAL", fallback: mayor número de la hoja). Mostrar TODAS las filas originales al usuario sin filtrar. Ver convención "Datos de Excel" en Guía de Estilo.

**Archivos afectados:** `components/UploadReceiptModal.tsx`, `components/TenantPortal.tsx`

---

## Self-Improvement Loop — Instrucción para Claude

Cada vez que el usuario deba corregirte un error:
1. **Analiza** la causa raíz: ¿fue una suposición incorrecta, una función mal usada, un patrón omitido?
2. **Propone** una nueva regla concisa que prevenga ese error específico.
3. **Edita este archivo** añadiendo una nueva entrada en "Lecciones Aprendidas" con:
   - Título descriptivo
   - Qué pasó (síntoma observable)
   - Causa raíz
   - Regla derivada (accionable y específica)
   - Archivos afectados

No esperes que el usuario te pida que actualices el archivo — hazlo proactivamente después de cada corrección.
