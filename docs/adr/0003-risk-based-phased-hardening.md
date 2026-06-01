# ADR-0003: Hardening por fases basado en riesgo

- **Estado:** Aceptado
- **Fecha:** 2026-06-01
- **Decisores:** Juan (owner), Claude (asistencia)

## Contexto

El objetivo es hacer la app "profesional y funcional al 100%": performance, código mantenible, listo para producción, y completar features. Es mucho trabajo y toca toda la base de código.

Restricción clave: **el camino de admin está en uso real con datos reales**, mientras que **los portales de inquilino y de Nora (EXPENSES_ADMIN) no están en uso todavía** (ver [CONTEXT.md](../../CONTEXT.md)). Romper el camino de admin tiene impacto inmediato; los portales no.

Se decidió ejecutar "todo, en fases ordenadas".

## Decisión

Ordenar el trabajo **de menor a mayor riesgo**, poniendo la red de tests antes de los refactors grandes, y aprovechando que los portales son zona de bajo riesgo para refactor agresivo y para completarse.

Orden de fases acordado:

- **Fase 0 — Riesgo cero:** cambios que no alteran el comportamiento feliz (limpieza de `vite.config.ts`, reemplazo/baja del `AGENTS.md` genérico, scripts `test`/`typecheck`, Error Boundaries que solo atrapan crashes, verificación de logging de producción y del `.env.local`).
- **Fase 1 — Red de seguridad:** infra de tests y cobertura amplia ([ADR-0002](0002-testing-strategy-vitest-mocked-supabase.md)).
- **Fase 2 — Tailwind build (v4) + producción:** ([ADR-0001](0001-tailwind-cdn-to-build.md)), self-host de assets, verificar PWA offline + build Android.
- **Fase 3 — Performance:** indexar pagos por `tenantId`, `React.memo`/`useCallback` en tarjetas y listas, revisar recálculos O(n²).
- **Fase 4 — Refactor de componentes gigantes** (admin, cubiertos por los tests de Fase 1): partir `DashboardViews`, `TenantsView`, `AddPropertyModal`.
- **Fase 5 — Completar y pulir portales** (inquilino + Nora) para lanzarlos: auditoría funcional, estados loading/empty, accesibilidad, verificación de RLS por rol.
- **Fase 6 — Calidad / DX:** TypeScript `strict` incremental, pre-commit hooks (Husky + lint-staged), CI básico (lint + typecheck + test + build), consolidar duplicación.

## Alternativas consideradas

1. **Refactorizar primero los componentes grandes (descartada).** Es lo de mayor riesgo y tocaría el camino de admin live sin red de tests previa.
2. **Hacer solo lo de admin y dejar portales para después (descartada).** El owner quiere dejar los portales listos para lanzar; además son la zona de menor riesgo para practicar refactor.

## Consecuencias

**Positivas:**
- El camino de admin live se toca recién cuando hay tests que lo cubren (Fase 4, apoyada en Fase 1).
- Las mejoras visibles y de bajo riesgo (Tailwind real, error boundaries) llegan temprano.
- Cada fase es entregable e independiente; se puede pausar entre fases.

**Negativas / riesgos:**
- Es un plan largo. Conviene tratar cada fase como un entregable con su propia verificación, no hacer todo de una.
- El orden puede ajustarse si surge una urgencia (ej: un bug en producción salta la cola).

## Próximo paso

Convertir este roadmap en issues accionables (sugerido: `/to-issues` o `/to-prd`) tomando una fase a la vez.
