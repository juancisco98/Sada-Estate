# Agent Instructions — Sada Estate

> Punto de entrada para cualquier agente de IA (Claude, Codex, Gemini, etc.) que trabaje en este repo.

Este proyecto es una **app React 19 + TypeScript + Vite + Supabase** de gestión de propiedades en alquiler (no un sistema de scripts Python). Las instrucciones reales viven en:

- **[CLAUDE.md](CLAUDE.md)** — convenciones técnicas, arquitectura y "Lecciones Aprendidas" (reglas derivadas de bugs reales). **Léelo siempre al iniciar.**
- **[CONTEXT.md](CONTEXT.md)** — lenguaje de dominio canónico (roles, entidades, máquina de estados de pago).
- **[docs/adr/](docs/adr/)** — decisiones arquitectónicas (Architecture Decision Records).
- **[docs/PRD-hardening.md](docs/PRD-hardening.md)** — PRD del esfuerzo de profesionalización en curso.

## Reglas no negociables (resumen — el detalle está en CLAUDE.md)

- **IDs de Supabase:** siempre `generateUUID()` manual. Nunca `Date.now()` ni `crypto.randomUUID()`.
- **Emails:** guardar `email.trim().toLowerCase()`; comparar con `.ilike()` + `.limit(1).maybeSingle()`.
- **Nombre de inquilino:** `property.tenantName`, nunca `getPropertyDisplayInfo().title`.
- **Logs de flujos críticos** (auth/pagos): `console.*` directo, nunca `logger` (silenciado en producción).
- **Mes "pagado"** solo si un pago tiene `status === 'APPROVED'`.
- **Modales largos:** patrón `flex flex-col max-h-[90vh]` + body `overflow-y-auto`.
- **Dark mode:** prefijo `dark:` en todos los componentes.

## Comandos

```bash
npm run dev        # servidor de desarrollo (Vite, puerto 3000)
npm run build      # build de producción
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (suite en construcción — ver docs/adr/0002)
```

## Self-improvement loop

Cuando el usuario corrija un error, agrega una "Lección Aprendida" en **CLAUDE.md** (causa raíz + regla derivada + archivos afectados). No esperes a que te lo pidan.
