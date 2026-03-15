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

**Dos sesiones de usuario:**
- **ADMIN**: Emails en `allowed_emails` table (juan.sada98@gmail.com, svsistemas@yahoo.com, antovent64@gmail.com). Acceso total.
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

### Tablas Supabase
- `allowed_emails` — whitelist de admins
- `properties` — inmuebles
- `buildings` — edificios (agrupan units)
- `tenants` — inquilinos
- `tenant_payments` — pagos mensuales (id: UUID, status: PENDING|REVISION|APPROVED)
- `professionals` — profesionales de mantenimiento
- `maintenance_tasks` — tareas de mantenimiento

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
