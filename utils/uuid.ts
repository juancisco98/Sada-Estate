/**
 * Generador canónico de UUID v4.
 *
 * NO usar `crypto.randomUUID()`: falla/cuelga en entornos HTTP sin TLS
 * (desarrollo local). Ver Lección 1/6 en CLAUDE.md.
 *
 * Esta es la fuente única de verdad. Los componentes que hoy definen su propia
 * copia de `generateUUID` deben migrar a este import (dedup — Fase 6a).
 */
export const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
