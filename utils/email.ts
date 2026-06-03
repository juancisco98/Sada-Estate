// Normalización canónica de emails para Sada Estate.
//
// Google OAuth devuelve los emails en minúsculas. Al guardar en Supabase
// normalizamos a `trim().toLowerCase()` para que las comparaciones (y las RLS
// policies con LOWER()) sean consistentes. Ver Lección 9 en CLAUDE.md.
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
