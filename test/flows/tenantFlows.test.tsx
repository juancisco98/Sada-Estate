import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createSupabaseMock, getActiveSupabaseClient, type SupabaseMock } from '../mocks/supabase';
import { generateUUID } from '@/utils/uuid';
import type { Tenant, TenantPayment } from '@/types';

// --- Mocks de los seams del hook ---
vi.mock('@/services/supabaseClient', () => ({
  get supabase() {
    return getActiveSupabaseClient();
  },
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}));

const toastSpies = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastSpies }));

const logAdminAction = vi.hoisted(() => vi.fn());
vi.mock('@/services/actionLogger', () => ({ logAdminAction }));

// DataContext controlado: setters como spies, estado leído por el hook.
let ctx: any;
vi.mock('@/context/DataContext', () => ({
  useDataContext: () => ctx,
}));

import { useTenantData } from '@/hooks/useTenantData';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let sb: SupabaseMock;

const setupContext = (over: Partial<any> = {}) => {
  ctx = {
    tenants: [],
    payments: [],
    properties: [],
    setTenants: vi.fn(),
    setPayments: vi.fn(),
    setProperties: vi.fn(),
    isLoading: false,
    refreshData: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  sb = createSupabaseMock({ tenants: [], tenant_payments: [], properties: [] });
  setupContext();
});

describe('handleRegisterPayment — UUID válido + status correcto', () => {
  it('inserta el pago en la DB con un UUID v4 válido y el status indicado', async () => {
    const { result } = renderHook(() => useTenantData('user-1'));
    const payment: TenantPayment = {
      id: generateUUID(),
      tenantId: 't1',
      propertyId: 'p1',
      amount: 4357099,
      currency: 'ARS',
      month: 6,
      year: 2026,
      paidOnTime: true,
      paymentDate: '2026-06-01',
      paymentMethod: 'TRANSFER',
      status: 'REVISION',
    };

    await act(async () => {
      await result.current.handleRegisterPayment(payment);
    });

    expect(sb.store.tenant_payments).toHaveLength(1);
    const saved = sb.store.tenant_payments[0];
    expect(saved.id).toMatch(UUID_V4_RE);
    expect(saved.status).toBe('REVISION');
    expect(saved.amount).toBe(4357099);
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'PAYMENT_REGISTERED' })
    );
  });
});

describe('handleUpdatePayment — aprobación REVISION → APPROVED', () => {
  it('actualiza el status del pago a APPROVED en la DB', async () => {
    sb.store.tenant_payments.push({
      id: 'pay-1',
      tenant_id: 't1',
      amount: 100000,
      currency: 'ARS',
      month: 5,
      year: 2026,
      status: 'REVISION',
      paid_on_time: true,
      payment_date: '2026-05-01',
    });
    setupContext({
      payments: [
        {
          id: 'pay-1',
          tenantId: 't1',
          amount: 100000,
          currency: 'ARS',
          month: 5,
          year: 2026,
          paidOnTime: true,
          paymentDate: '2026-05-01',
          paymentMethod: 'TRANSFER',
          status: 'REVISION',
        } as TenantPayment,
      ],
    });

    const { result } = renderHook(() => useTenantData('user-1'));
    await act(async () => {
      await result.current.handleUpdatePayment({
        id: 'pay-1',
        tenantId: 't1',
        amount: 100000,
        currency: 'ARS',
        month: 5,
        year: 2026,
        paidOnTime: true,
        paymentDate: '2026-05-01',
        paymentMethod: 'TRANSFER',
        status: 'APPROVED',
      } as TenantPayment);
    });

    expect(sb.store.tenant_payments[0].status).toBe('APPROVED');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'PAYMENT_APPROVED' })
    );
  });
});

describe('handleSaveTenant — recuperación ante violación de FK (Lección 14)', () => {
  it('ante 23503 en property_id: revierte el state, avisa y refresca', async () => {
    sb.forceError('tenants', 'upsert', {
      code: '23503',
      message:
        'insert or update on table "tenants" violates foreign key constraint "tenants_property_id_fkey"',
    });

    const tenant: Tenant = {
      id: generateUUID(),
      name: 'Nuevo Inquilino',
      phone: '111',
      email: 'nuevo@example.com',
      propertyId: 'prop-fantasma',
    };

    const { result } = renderHook(() => useTenantData('user-1'));

    // try/catch directo (no act): el handler relanza tras revertir; envolverlo en
    // act() generaba una carrera entre el microtask del rollback y la aserción.
    let thrown: unknown = null;
    try {
      await result.current.handleSaveTenant(tenant);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    // Rollback del state optimista (restaura el array previo)
    expect(ctx.setTenants).toHaveBeenCalledWith([]);
    // Aviso amigable (no el error crudo de Postgres) + refresh automático
    expect(toastSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('La propiedad seleccionada ya no existe')
    );
    expect(ctx.refreshData).toHaveBeenCalled();
  });

  it('alta exitosa: hace upsert del inquilino y registra la acción', async () => {
    const tenant: Tenant = {
      id: generateUUID(),
      name: 'Inquilino OK',
      phone: '222',
      email: 'OK@Example.com',
      propertyId: null,
    };

    const { result } = renderHook(() => useTenantData('user-1'));
    await act(async () => {
      await result.current.handleSaveTenant(tenant);
    });

    expect(sb.store.tenants).toHaveLength(1);
    // tenantToDb normaliza el email a minúsculas
    expect(sb.store.tenants[0].email).toBe('ok@example.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'TENANT_CREATED' })
    );
  });
});
