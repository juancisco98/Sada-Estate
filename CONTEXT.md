# CONTEXT.md — Lenguaje de Dominio de Sada Estate

Vocabulario canónico del proyecto. Si un término aparece acá, usalo tal cual en código, UI, commits y docs. Complementa a [CLAUDE.md](CLAUDE.md) (convenciones técnicas) y a los ADRs en [docs/adr/](docs/adr/) (decisiones arquitectónicas).

---

## Roles de usuario (sesiones)

| Término canónico | Significado | Tabla / fuente |
|---|---|---|
| **ADMIN** | Usuario con acceso total al sistema. Gestiona propiedades, inquilinos, pagos, mantenimiento. | `allowed_emails` |
| **EXPENSES_ADMIN** | Admin acotado que SOLO gestiona expensas. Coloquialmente **"Nora"**. Ve únicamente `ExpensesAdminPortal`. | `expenses_admins` |
| **TENANT** (inquilino) | Persona que alquila. Solo ve su propio portal de pagos (`TenantPortal`). | `tenants` |

- **"Nora"** = nombre coloquial del rol EXPENSES_ADMIN. En código usar `EXPENSES_ADMIN`; "Nora" solo en conversación/UI orientada al usuario.

---

## Entidades del dominio

| Término | Significado | Tabla |
|---|---|---|
| **Property** (propiedad / inmueble) | Unidad alquilable. Puede ser casa standalone o una unidad dentro de un edificio. | `properties` |
| **Building** (edificio) | Agrupa varias Units (propiedades). | `buildings` |
| **Unit** (unidad) | Propiedad que pertenece a un Building (`buildingId` no nulo). | `properties` |
| **Tenant** (inquilino) | Ver roles. | `tenants` |
| **Payment** (pago) | Pago mensual de alquiler de un inquilino. Tiene `status`. | `tenant_payments` |
| **Expense Sheet** (liquidación de expensas) | Hoja de expensas de un mes. `sheet_data` (JSONB) tiene las filas del Excel; o un PDF embebido. | `expense_sheets` |
| **Professional** (profesional) | Prestador de servicios de mantenimiento. | `professionals` |
| **Maintenance Task** (tarea de mantenimiento) | Trabajo asignado a un profesional sobre una propiedad. | `maintenance_tasks` |
| **Reminder** (recordatorio) | Recordatorio manual o generado por IA. | `reminders` |
| **Smart Action / Automation** | Propuesta automática (auto-aprobar pago, etc.) generada por la edge function de automatización a partir de patrones del admin. | `automation_rules`, `automation_history` |
| **Notification** | Aviso para admins o inquilinos. | `notifications` |

---

## Máquina de estados de Pago (canónica)

```
PENDING  →  (inquilino sube comprobantes)  →  REVISION  →  (admin aprueba)  →  APPROVED
```

- **PENDING**: no existe registro de pago para ese mes.
- **REVISION**: el inquilino subió comprobantes; espera revisión del admin. **Color ámbar + Clock.**
- **APPROVED**: el admin verificó y aprobó. **Color verde + CheckCircle.**
- Un mes se considera **pagado** SOLO si tiene un pago con `status === 'APPROVED'` (nunca por la mera existencia de un registro). Ver Lección 4 en CLAUDE.md.

---

## Conceptos arquitectónicos

| Término | Significado |
|---|---|
| **Camino de admin** (*admin path*) | Código y vistas que los admins YA usan en producción con datos reales: `App.tsx`, `DataContext`, `DashboardViews`, `TenantsView`, `MapBoard`, hooks de admin. **Zona de alto cuidado / cambios retrocompatibles.** |
| **Portales** | `TenantPortal` (inquilino) y `ExpensesAdminPortal` + `ExpensesTenantDetail` (Nora). **NO están en uso todavía** → zona de bajo riesgo, apta para refactor agresivo y para completarse antes de lanzar. |
| **Fuente única de verdad** | `context/DataContext.tsx`. Todo dato de la app sale de ahí; los componentes nunca guardan copias locales de datos de tabla (causa stale state tras realtime). |
| **Mapper** | Función de conversión DB↔App en `utils/mappers.ts`. `dbToX()` (snake_case → camelCase) y `XToDb()` (inverso). |
| **Lazy-load de `sheet_data`** | El JSONB pesado de expensas NO se trae en el `select` inicial; se carga on-demand con `loadExpenseSheetData(id)`. |

---

## Términos establecidos en la sesión de grilling (2026-06-01)

- **Camino de admin** vs **Portales**: distinción de riesgo introducida arriba — guía el orden del roadmap de hardening (ver [ADR-0003](docs/adr/0003-risk-based-phased-hardening.md)).
- **Hardening por fases**: el plan de "hacerlo profesional y 100% funcional" se ejecuta en fases ordenadas de menor a mayor riesgo, con la red de tests antes de los refactors grandes.

---

## Convenciones de nomenclatura rápidas

- IDs de Supabase: SIEMPRE `generateUUID()` manual. NUNCA `Date.now()` / `crypto.randomUUID()`. (Lección 1, 6)
- Emails: guardar `email.trim().toLowerCase()`; comparar con `.ilike()` + `.limit(1).maybeSingle()`. (Lección 9, 10)
- Nombre del inquilino: `property.tenantName`, NUNCA `getPropertyDisplayInfo().title`. (Lección 2)
- Logs de flujos críticos (auth/pagos): `console.*` directo, NO `logger` (silenciado en prod). (Lección 11)
