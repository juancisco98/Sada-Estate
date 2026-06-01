import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TenantPayment } from '@/types';

// getTenantMetrics vive dentro de useTenantData, que lee useDataContext.
// Mockeamos sólo el contexto para probar la lógica real de métricas sin tocar
// Supabase ni el resto del código admin.
let ctxValue: any;
vi.mock('@/context/DataContext', () => ({
  useDataContext: () => ctxValue,
}));

import { useTenantData } from '@/hooks/useTenantData';

const YEAR = new Date().getFullYear();

const makePayment = (over: Partial<TenantPayment>): TenantPayment => ({
  id: Math.random().toString(36).slice(2),
  tenantId: 't1',
  propertyId: 'p1',
  amount: 100000,
  currency: 'ARS',
  month: 1,
  year: YEAR,
  paidOnTime: true,
  paymentDate: `${YEAR}-01-05`,
  paymentMethod: 'TRANSFER',
  status: 'APPROVED',
  ...over,
});

const setPayments = (payments: TenantPayment[]) => {
  ctxValue = {
    tenants: [],
    payments,
    properties: [],
    setTenants: vi.fn(),
    setPayments: vi.fn(),
    setProperties: vi.fn(),
    isLoading: false,
    refreshData: vi.fn().mockResolvedValue(undefined),
  };
};

const metricsFor = (payments: TenantPayment[], tenantId = 't1') => {
  setPayments(payments);
  const { result } = renderHook(() => useTenantData('u1'));
  return result.current.getTenantMetrics(tenantId);
};

describe('getTenantMetrics — un mes es "pagado" SOLO con APPROVED (Lección 4)', () => {
  beforeEach(() => {
    ctxValue = undefined;
  });

  it('un pago APPROVED marca el mes como paid', () => {
    const m = metricsFor([makePayment({ month: 5, status: 'APPROVED' })]);
    const may = m.monthlyBreakdown[4] as { paid: boolean; status?: string };
    expect(may.paid).toBe(true);
    expect(may.status).toBe('APPROVED');
  });

  it('un pago en REVISION NO marca el mes como paid (ámbar, no verde)', () => {
    const m = metricsFor([makePayment({ month: 5, status: 'REVISION' })]);
    const may = m.monthlyBreakdown[4] as { paid: boolean; status?: string };
    expect(may.paid).toBe(false);
    expect(may.status).toBe('REVISION');
  });

  it('totalPaid y totalExpenses sólo suman pagos APPROVED', () => {
    const m = metricsFor([
      makePayment({ month: 3, amount: 100000, expenseAmount: 5000, status: 'APPROVED' }),
      makePayment({ month: 4, amount: 200000, expenseAmount: 9000, status: 'REVISION' }),
    ]);
    expect(m.totalPaid).toBe(100000);
    expect(m.totalExpenses).toBe(5000);
  });

  it('calcula onTimeRate a partir de paidOnTime', () => {
    const m = metricsFor([
      makePayment({ month: 1, paidOnTime: true }),
      makePayment({ month: 2, paidOnTime: true }),
      makePayment({ month: 3, paidOnTime: false }),
      makePayment({ month: 4, paidOnTime: false }),
    ]);
    expect(m.totalPayments).toBe(4);
    expect(m.onTimePayments).toBe(2);
    expect(m.onTimeRate).toBe(50);
  });

  it('inquilino sin pagos devuelve métricas vacías', () => {
    const m = metricsFor([], 'desconocido');
    expect(m.totalPaid).toBe(0);
    expect(m.totalPayments).toBe(0);
    expect(m.monthlyBreakdown.every((b) => b.paid === false)).toBe(true);
  });
});
