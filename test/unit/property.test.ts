import { describe, it, expect } from 'vitest';
import { isPlaceholderName, getPropertyDisplayInfo } from '@/utils/property';

describe('isPlaceholderName', () => {
  it('reconoce placeholders de unidad y vacantes', () => {
    for (const n of ['VACANTE', '-', 'u1', 'd15', 'dpto 4', 'unidad 2', '2B']) {
      expect(isPlaceholderName(n)).toBe(true);
    }
  });

  it('reconoce nombres reales de personas', () => {
    for (const n of ['Juan Pérez', 'Nora', 'Ana', 'Eugenia Sada']) {
      expect(isPlaceholderName(n)).toBe(false);
    }
  });
});

describe('getPropertyDisplayInfo', () => {
  it('casa standalone: título = dirección, subtítulo = inquilino', () => {
    const info = getPropertyDisplayInfo({
      id: 'p1-abc',
      tenantName: 'Juan Pérez',
      address: 'Vélez Sársfield 134, CABA',
      type: 'casa',
    });
    expect(info.title).toBe('VÉLEZ SÁRSFIELD 134');
    expect(info.subtitle).toBe('JUAN PÉREZ');
  });

  it('casa standalone vacante: subtítulo = VACANTE', () => {
    const info = getPropertyDisplayInfo({
      id: 'p2',
      tenantName: 'VACANTE',
      address: 'Calle Falsa 123',
      type: 'casa',
    });
    expect(info.subtitle).toBe('VACANTE');
  });

  it('unidad de edificio con nombre placeholder: título = label de unidad', () => {
    const info = getPropertyDisplayInfo({
      id: 'p3',
      tenantName: 'u1',
      unitLabel: 'Dpto 3',
      buildingId: 'b1',
      type: 'edificio',
    });
    expect(info.title).toBe('DPTO 3');
    expect(info.subtitle).toBe('U1');
  });

  it('unidad de edificio: separa nombre real del piso embebido', () => {
    const info = getPropertyDisplayInfo({
      id: 'p4',
      tenantName: 'Eugenia 2B',
      buildingId: 'b1',
      type: 'edificio',
    });
    expect(info.title).toBe('EUGENIA');
    expect(info.subtitle).toBe('2B');
  });
});
