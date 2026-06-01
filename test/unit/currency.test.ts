import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatCurrency, convertCurrency, EXCHANGE_RATES } from '@/utils/currency';

describe('formatCurrency', () => {
  it('formatea ARS sin decimales y con separador de miles', () => {
    const out = formatCurrency(1234567, 'ARS').replace(/\s/g, '');
    expect(out).toMatch(/1\.234\.567/);
    expect(out).not.toMatch(/,/); // maximumFractionDigits: 0 → sin centavos
  });

  it('redondea a entero', () => {
    const out = formatCurrency(999.99, 'ARS').replace(/\s/g, '');
    expect(out).toMatch(/1\.000/);
  });
});

describe('convertCurrency (placeholder síncrono)', () => {
  it('devuelve el mismo monto cuando las monedas coinciden', () => {
    expect(convertCurrency(500, 'ARS', 'ARS')).toBe(500);
  });
});

describe('EXCHANGE_RATES', () => {
  it('define USD como base (1) y ARS/UYU > 1', () => {
    expect(EXCHANGE_RATES.USD).toBe(1);
    expect(EXCHANGE_RATES.ARS).toBeGreaterThan(1);
    expect(EXCHANGE_RATES.UYU).toBeGreaterThan(1);
  });
});

describe('fetchLiveArsRate (con fetch mockeado)', () => {
  beforeEach(() => {
    vi.resetModules(); // limpia el cache module-level del rate
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el precio de venta de la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ venta: 1450, compra: 1400 }) })
    );
    const { fetchLiveArsRate } = await import('@/utils/currency');
    expect(await fetchLiveArsRate()).toBe(1450);
  });

  it('cae al rate de fallback si la API falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const mod = await import('@/utils/currency');
    expect(await mod.fetchLiveArsRate()).toBe(mod.EXCHANGE_RATES.ARS);
  });
});
