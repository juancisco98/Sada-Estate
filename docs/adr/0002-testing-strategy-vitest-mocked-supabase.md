# ADR-0002: Estrategia de testing — Vitest + RTL con Supabase mockeado

- **Estado:** Aceptado
- **Fecha:** 2026-06-01
- **Decisores:** Juan (owner), Claude (asistencia)

## Contexto

La app no tiene **ningún** test automatizado. El camino de admin está en uso real con datos reales (ver [CONTEXT.md](../../CONTEXT.md)), y el plan incluye refactorizar componentes grandes (`DashboardViews` 1568 líneas, `TenantsView` 1114, `AddPropertyModal` 968). Refactorizar sin red de seguridad sobre datos reales es de alto riesgo.

Se decidió que se quiere **cobertura amplia**: tests de integración sobre los flujos críticos — auth/routing por rol, alta de inquilino (con validación de FK), registro de pago, y transición de estado de pago (PENDING → REVISION → APPROVED).

Esos flujos tocan Supabase. La arquitectura actual hace que los hooks llamen `supabase.from()...` directamente y que `DataContext` administre el realtime.

## Decisión

Usar **Vitest + React Testing Library + jsdom**, con el **cliente de Supabase mockeado** (mock del módulo `services/supabaseClient`).

Cobertura objetivo (amplia):

1. **Lógica pura (unit):** `utils/mappers.ts`, `getTenantMetrics` (hooks/useTenantData), `utils/expenseSheetParser.ts`, `utils/currency.ts`, `utils/property.ts`.
2. **Flujos / handlers (integración con mock):**
   - Routing por rol: ADMIN / EXPENSES_ADMIN / TENANT van a la vista correcta.
   - Alta de inquilino: validación de FK contra state local antes de enviar.
   - Registro de pago: genera UUID válido, status correcto.
   - Aprobación de pago: REVISION → APPROVED, y que `paid` solo sea true con APPROVED.
3. **Smoke render:** cada vista principal monta sin crashear con datos mock.

Agregar scripts `test` (y `test:watch`, `coverage`) y un `typecheck` a `package.json`.

## Alternativas consideradas

1. **Proyecto Supabase de test + Playwright E2E (descartada).** Probaría RLS, triggers y storage reales, pero exige crear y mantener un segundo proyecto Supabase, es más lento y más frágil. Sobredimensionado para una app familiar.
2. **Combinado (Vitest mock + algunos Playwright) (descartada por ahora).** Máxima confianza pero más setup. Se puede sumar E2E puntual más adelante si hace falta; no es el punto de partida.
3. **Solo verificación manual (descartada).** No protege contra regresiones en refactors grandes sobre datos reales.

## Consecuencias

**Positivas:**
- Tests rápidos, deterministas, que no tocan datos reales.
- Habilitan refactorizar los componentes gigantes con confianza.
- Sirven de documentación viva de los flujos.

**Negativas / riesgos:**
- El mock de Supabase **no** valida RLS, triggers ni storage reales. Esos siguen verificándose manualmente o con E2E futuro.
- Hay que mantener el mock alineado con el contrato real de Supabase (forma de respuestas `{ data, error }`, `.ilike`, `.limit`, `.maybeSingle`, canales realtime).

## Mitigación

- Centralizar el mock de Supabase en un helper de test reutilizable que imite el contrato (`from().select().eq()...` → `{ data, error }`).
- Para RLS/triggers, mantener verificación manual con usuarios de prueba de cada rol antes de lanzar los portales.
