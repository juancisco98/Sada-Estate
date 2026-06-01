import { describe, it, expect } from 'vitest';
import { generateUUID } from '@/utils/uuid';

// UUID v4 canónico: 8-4-4-4-12 hex, con '4' en la posición de versión
// y uno de [8,9,a,b] en la de variante.
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUUID (Lección 1/6)', () => {
  it('produce un UUID v4 con formato válido', () => {
    expect(generateUUID()).toMatch(UUID_V4_RE);
  });

  it('fija la versión 4 y la variante correctamente en muchas muestras', () => {
    for (let i = 0; i < 500; i++) {
      const id = generateUUID();
      expect(id).toMatch(UUID_V4_RE);
      expect(id[14]).toBe('4'); // dígito de versión
      expect(['8', '9', 'a', 'b']).toContain(id[19]); // dígito de variante
    }
  });

  it('genera valores únicos (sin colisiones en una muestra grande)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateUUID());
    expect(seen.size).toBe(5000);
  });
});
