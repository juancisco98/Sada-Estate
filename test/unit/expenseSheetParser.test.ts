import { describe, it, expect } from 'vitest';
import { parseExpenseSheet } from '@/utils/expenseSheetParser';

describe('parseExpenseSheet (Lección 12 — sin índices hardcodeados)', () => {
  it('usa la fila TOTAL como total general y la excluye de los items', () => {
    const rows: unknown[][] = [
      ['Liquidación de Expensas - MAYO 2026'],
      ['Concepto', 'Importe'],
      ['Limpieza', 5000],
      ['Luz', '$ 3.500'],
      ['Administración', 1500],
      ['TOTAL', 10000],
    ];
    const result = parseExpenseSheet(rows);

    expect(result.total).toBe(10000);
    expect(result.items).toEqual([
      { concept: 'Limpieza', amount: 5000 },
      { concept: 'Luz', amount: 3500 },
      { concept: 'Administración', amount: 1500 },
    ]);
    expect(result.items.find((i) => /total/i.test(i.concept))).toBeUndefined();
    expect(result.currency).toBe('ARS');
  });

  it('detecta el período (mes + año) en el encabezado', () => {
    const rows: unknown[][] = [['EXPENSAS MAYO 2026'], ['Limpieza', 5000]];
    expect(parseExpenseSheet(rows).period).toBe('MAYO 2026');
  });

  it('si no hay fila TOTAL, suma los items (fallback)', () => {
    const rows: unknown[][] = [
      ['Limpieza', 5000],
      ['Luz', 3500],
    ];
    expect(parseExpenseSheet(rows).total).toBe(8500);
  });

  it('parsea montos con formato $ y separadores de miles', () => {
    const rows: unknown[][] = [['Administración', '$ 1.234.567']];
    expect(parseExpenseSheet(rows).items[0].amount).toBe(1234567);
  });

  it('ignora filas vacías y encabezados sin monto', () => {
    const rows: unknown[][] = [
      [],
      ['Concepto', 'Importe'],
      ['', ''],
      ['Limpieza', 5000],
    ];
    const result = parseExpenseSheet(rows);
    expect(result.items).toEqual([{ concept: 'Limpieza', amount: 5000 }]);
  });

  it('hoja vacía → total 0, sin items, sin período', () => {
    const result = parseExpenseSheet([]);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.period).toBeUndefined();
  });
});
