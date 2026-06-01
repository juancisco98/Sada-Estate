# ADR-0001: Migrar Tailwind del CDN a un build real (Tailwind v4)

- **Estado:** Aceptado
- **Fecha:** 2026-06-01
- **Decisores:** Juan (owner), Claude (asistencia)

## Contexto

Hoy Tailwind se carga vía `<script src="https://cdn.tailwindcss.com">` en [index.html](../../index.html), con la config inline en un `tailwind.config = {...}`. El CSS de Leaflet y la fuente Inter también vienen de CDNs (`unpkg`, `fonts.googleapis.com`).

El CDN de Tailwind es una herramienta de **prototipado**, no de producción. El propio Tailwind lo advierte. Problemas concretos para Sada Estate:

- **Performance:** compila todo Tailwind en el navegador en cada carga; sin purga (PurgeCSS), entrega CSS enorme. Pesa en móvil y en conexiones lentas.
- **Offline / PWA:** la app apunta a funcionar como PWA y como app Android (Capacitor). Un `<script>` remoto no está garantizado offline ni dentro del WebView de Capacitor.
- **Warning en consola:** el CDN imprime un warning de "no usar en producción" — poco profesional.

La app se despliega **tanto en web (Vercel) como en Android (Capacitor)**, ambos por igual, lo que vuelve el soporte offline/empaquetado un requisito real.

## Decisión

Migrar Tailwind a un **build local con PostCSS**, usando **Tailwind v4** (config CSS-first vía `@theme`), e instalarlo como dependencia del proyecto. Como parte de la migración:

- Mover la config actual (`darkMode: 'class'`, colores `dark.bg`/`dark.card`) al nuevo formato CSS-first de v4.
- Mover los estilos inline de `index.html` (scrollbar, body, overrides de Leaflet) a una hoja CSS importada por Vite.
- Quitar el `<script>` del CDN.
- Evaluar self-hostear la fuente **Inter** y el **CSS de Leaflet** para no depender de CDNs en offline/Capacitor.

## Alternativas consideradas

1. **Tailwind v3.4 + PostCSS (descartada como opción principal).** Reusa la config JS tal cual; riesgo visual casi nulo. Se descartó a favor de v4 por preferencia explícita del owner de usar la versión moderna (build más rápido, config CSS-first).
2. **Seguir con el CDN (descartada).** No cumple con requisitos de producción, offline ni Capacitor.

## Consecuencias

**Positivas:**
- Build de producción real con purga → CSS mínimo, carga rápida.
- Funciona offline y dentro de Capacitor sin depender de red.
- Sin warnings; pipeline reproducible.

**Negativas / riesgos:**
- v4 cambia el modelo de config (JS → CSS). Hay que migrar la config y **verificar visualmente pantalla por pantalla** (web + WebView Android) que no haya diferencias de estilo. Los smoke tests de render (ver [ADR-0002](0002-testing-strategy-vitest-mocked-supabase.md)) ayudan a detectar regresiones de montaje, pero el diff visual fino es manual.
- Posibles diferencias de comportamiento entre clases del CDN y de v4 que requieran ajustes puntuales.

## Mitigación

- Hacer la migración en su propia fase, **después** de tener la red de tests.
- Verificar dark mode (`class` strategy) explícitamente, que es central en la UI.
- Comparar capturas antes/después de cada vista clave.
