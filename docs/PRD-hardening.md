# PRD — Hardening de Sada Estate ("profesional y 100% funcional")

> Documento de producto del esfuerzo de hardening por fases. Fuentes: [CONTEXT.md](../CONTEXT.md), [CLAUDE.md](../CLAUDE.md), ADRs [0001](adr/0001-tailwind-cdn-to-build.md)/[0002](adr/0002-testing-strategy-vitest-mocked-supabase.md)/[0003](adr/0003-risk-based-phased-hardening.md). Issues de ejecución: #2–#11.

## Problem Statement

Sada Estate funciona y el **camino de admin está en uso real con datos reales** (familia Sada), pero la base no está lista para considerarse "profesional y 100% funcional":

- Tailwind se sirve desde el **CDN de prototipado** (`cdn.tailwindcss.com`): compila en el navegador, sin purga, con warning de "no usar en producción", y sin garantía offline dentro de la PWA/WebView de Capacitor.
- **No existe ningún test automatizado.** Refactorizar componentes gigantes (DashboardViews 1568 líneas, TenantsView 1114, AddPropertyModal 968) sobre datos reales es de alto riesgo.
- Un crash de render deja **pantalla en blanco** (sin Error Boundaries).
- Hay lag por recálculos O(n×m×12) en métricas, falta de indexación de pagos y de memoización.
- Higiene pendiente: `vite.config.ts` con código comentado, `AGENTS.md` genérico que no aplica al stack, sin scripts `test`/`typecheck`, TypeScript no `strict`, duplicación (MONTH_NAMES, normalización de email), sin pre-commit hooks ni CI.
- Los **portales de inquilino (TenantPortal) y de Nora (ExpensesAdminPortal)** todavía NO están en uso y no están pulidos para lanzarse.

## Solution

Llevar la app a estado profesional mediante un **hardening por fases ordenadas de menor a mayor riesgo** (ADR-0003), poniendo una **red de tests** (Vitest + Supabase mockeado) ANTES de tocar el camino de admin live. El usuario obtiene: una app rápida, que funciona offline/en Android, que no se rompe en pantalla blanca, con código mantenible y portales listos para lanzar — sin regresiones en lo que ya usa a diario.

## User Stories

1. Como **admin**, quiero que la app cargue rápido en el móvil, para gestionar propiedades sin esperas.
2. Como **admin**, quiero que la app funcione offline / dentro de la app Android, para usarla sin conexión estable.
3. Como **admin**, quiero que un error de una vista no me deje la pantalla en blanco, para poder seguir trabajando o reintentar.
4. Como **admin**, quiero que el nuevo alquiler ajustado por IPC se refleje al registrar el pago del mes siguiente, para no recargar montos viejos (Lección 15).
5. Como **admin**, quiero que un mes solo figure "pagado" cuando aprobé el pago, para distinguir REVISION (ámbar) de APPROVED (verde) (Lección 4).
6. Como **admin**, quiero ver en el dropdown solo propiedades válidas al dar de alta un inquilino, para no provocar errores de FK (Lección 14).
7. Como **admin**, quiero recibir un mensaje claro cuando una operación falla, para entender qué pasó y reintentar (Lección 5).
8. Como **admin**, quiero que los cambios que hace otro admin (borrar propiedad, etc.) se propaguen en tiempo real, para no operar sobre datos viejos (Lección 14).
9. Como **desarrollador**, quiero una suite de tests que cubra la lógica pura (mappers, métricas, parser de expensas, currency, property), para refactorizar con confianza.
10. Como **desarrollador**, quiero tests de los flujos críticos (routing por rol, alta de inquilino con FK, registro y aprobación de pago), para evitar regresiones sobre datos reales.
11. Como **desarrollador**, quiero un mock reutilizable de Supabase que imite el contrato real, para escribir tests rápidos y deterministas sin tocar datos reales.
12. Como **desarrollador**, quiero un smoke test que monte cada vista principal, para detectar crashes de montaje temprano.
13. Como **desarrollador**, quiero `getTenantMetrics` extraída a función pura, para testearla aislada sin renderizar React.
14. Como **desarrollador**, quiero scripts `test`, `test:watch`, `coverage` y `typecheck`, para correr calidad localmente.
15. Como **desarrollador**, quiero Tailwind con build real (v4, PostCSS, purga), para entregar CSS mínimo y reproducible.
16. Como **desarrollador**, quiero la fuente Inter y el CSS de Leaflet self-hosteados, para no depender de CDNs en offline/Capacitor.
17. Como **desarrollador**, quiero `vite.config.ts` limpio y un `AGENTS.md` acorde al stack, para no confundir a futuros colaboradores.
18. Como **desarrollador**, quiero los pagos indexados por `tenantId` (Map), para evitar `.filter()` N veces y recálculos O(n²).
19. Como **desarrollador**, quiero `React.memo`/`useCallback` en tarjetas y listas, para reducir re-renders innecesarios.
20. Como **desarrollador**, quiero partir los componentes gigantes en piezas testeables, para mantener y evolucionar el código.
21. Como **desarrollador**, quiero TypeScript `strict` incremental, para atrapar errores de tipo en compilación.
22. Como **desarrollador**, quiero pre-commit hooks (lint + typecheck) y CI (lint + typecheck + test + build), para que la calidad no dependa de la memoria.
23. Como **desarrollador**, quiero consolidar duplicación (MONTH_NAMES, normalización de email), para una sola fuente de verdad.
24. Como **inquilino**, quiero un portal pulido con estados de carga/vacío/error claros, para subir mis comprobantes sin confusión.
25. Como **inquilino**, quiero ver la liquidación (Excel con desglose y total, o PDF embebido) y completar el monto cuando corresponde, para pagar el importe correcto (Lección 12/16).
26. Como **inquilino**, quiero ver solo mis propios datos, para tener privacidad (RLS por rol).
27. Como **EXPENSES_ADMIN (Nora)**, quiero un portal de expensas pulido y verificado, para gestionar liquidaciones sin ver el resto del sistema.
28. Como **owner**, quiero verificar visualmente cada pantalla tras migrar Tailwind, para confirmar que no cambió el diseño (incluido dark mode).
29. Como **owner**, quiero verificar la RLS por rol con usuarios de prueba antes de lanzar los portales, para garantizar el aislamiento de datos.
30. Como **owner**, quiero que el roadmap se ejecute en fases entregables e independientes, para poder pausar entre fases.

## Implementation Decisions

- **Orden por riesgo (ADR-0003):** Fase 0 (riesgo cero) → 1 (tests) → 2 (Tailwind) → 3 (perf) → 4 (refactor admin) → 5 (portales) → 6 (DX). El camino de admin live solo se refactoriza (Fase 4) cuando hay red de tests (Fase 1).
- **Testing (ADR-0002):** Vitest + React Testing Library + jsdom, con `services/supabaseClient` **mockeado** mediante un helper central que imita el contrato (`from().select().eq()/.ilike()/.limit()/.maybeSingle()` → `{data, error}`, canales realtime). NO se prueban RLS/triggers/storage reales con el mock (eso queda manual / E2E futuro).
- **Tailwind (ADR-0001):** migrar a **Tailwind v4** con PostCSS, config CSS-first (`@theme`), `darkMode: 'class'`, colores `dark.bg`/`dark.card`. Mover estilos inline de `index.html` a CSS importado por Vite. Self-host de Inter y Leaflet. Quitar el `<script>` del CDN.
- **Módulos profundos a extraer/consolidar:** `getTenantMetrics` → función pura `(tenants, payments) → metrics`; `normalizeEmail()` único; `generateUUID()` centralizado; `expenseSheetParser` endurecido (total dinámico, PDF=0). Mappers, currency y property ya son módulos.
- **Performance:** índice `Map<tenantId, Payment[]>`; `React.memo`/`useCallback` en PropertyCard, BuildingCard, FinancialDetailsCard y listas; `value` del DataContext en `useMemo` con deps explícitas.
- **Error Boundaries:** global + por-vista, con fallback amigable.
- **Convenciones invariantes (CLAUDE.md):** IDs siempre `generateUUID()` (nunca Date.now()/crypto.randomUUID()); emails `.trim().toLowerCase()` + `.ilike()` + `.limit(1).maybeSingle()`; nombre de inquilino `property.tenantName`; logs de auth/pagos con `console.*` (no `logger`); modales con patrón `flex flex-col max-h-[90vh]`.
- **DX:** scripts `test`/`test:watch`/`coverage`/`typecheck`; Husky + lint-staged; CI GitHub Actions (lint + typecheck + test + build); TypeScript `strict` incremental.

## Testing Decisions

- **Qué hace un buen test:** prueba comportamiento externo (entradas → salidas, transiciones de estado observables), no detalles de implementación. Los tests deben sobrevivir a un refactor interno.
- **Módulos testeados (unit, lógica pura):** `mappers` (ida y vuelta), `getTenantMetrics` (incl. "pagado solo con APPROVED"), `expenseSheetParser` (total dinámico, caso PDF), `currency`, `property`, `generateUUID` (v4 válido), `normalizeEmail`.
- **Flujos (integración con mock):** routing por rol (ADMIN/EXPENSES_ADMIN/TENANT), alta de inquilino con validación de FK, registro de pago (UUID + status), aprobación REVISION → APPROVED, lookup de email tolerante a duplicados/case.
- **Smoke render:** cada vista principal monta sin crashear con datos mock.
- **Prior art:** no hay tests previos; la Fase 1a establece el patrón (helper de mock central + primer test trazador) que el resto reutiliza.
- **Lo que el mock NO cubre:** RLS, triggers y storage reales → verificación manual con usuarios de prueba de cada rol antes de lanzar portales (Fase 5).

## Out of Scope

- Proyecto Supabase de test + E2E con Playwright (descartado en ADR-0002; se puede sumar más adelante).
- Nuevas features de negocio (este esfuerzo es hardening, no expansión funcional).
- Cambios de esquema de base de datos salvo los que exijan correcciones puntuales.
- Rediseño visual: la migración de Tailwind debe ser **iso-visual** (mismo aspecto), no un rediseño.
- Migrar a otra versión mayor de React/Vite/Supabase.

## Further Notes

- Cada fase es un entregable independiente con su propia verificación (issues #2–#11). El orden puede reordenarse si surge un bug de producción urgente.
- Las Fases 2 (Tailwind) y 5 (portales) son **HITL**: requieren verificación visual / auditoría con usuarios de prueba del owner.
- Mantener `CLAUDE.md` actualizado con cualquier lección nueva que surja durante la ejecución (self-improvement loop).
