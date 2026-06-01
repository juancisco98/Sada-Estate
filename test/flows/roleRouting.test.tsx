import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { createSupabaseMock, getActiveSupabaseClient, type SupabaseMock } from '../mocks/supabase';

// Mock del cliente real (lee del registro de mock activo).
vi.mock('@/services/supabaseClient', () => ({
  get supabase() {
    return getActiveSupabaseClient();
  },
  signInWithGoogle: (...a: any[]) => getActiveSupabaseClient().auth.signInWithOAuth(...a),
  signOut: () => getActiveSupabaseClient().auth.signOut(),
}));

// Hijos pesados stubeados: MapBoard usa Leaflet (no monta en jsdom); los portales
// son lazy y tienen su propia data. Para el test de routing sólo importa a qué
// vista llega cada rol, no el interior de cada vista.
vi.mock('@/components/MapBoard', () => ({ default: () => createElement('div', null, 'MAPA') }));
vi.mock('@/components/TenantPortal', () => ({
  default: () => createElement('div', null, 'PORTAL_INQUILINO'),
}));
vi.mock('@/components/ExpensesAdminPortal', () => ({
  default: () => createElement('div', null, 'PORTAL_EXPENSAS'),
}));

import App from '@/App';

let sb: SupabaseMock;

const sessionFor = (email: string, id = 'uid-1') => ({
  user: { id, email, user_metadata: { full_name: 'Usuario Test' } },
});

const seedBase = () => ({
  professionals: [],
  properties: [],
  maintenance_tasks: [],
  buildings: [],
  tenants: [],
  tenant_payments: [],
  notifications: [],
  expense_sheets: [],
  reminders: [],
  automation_rules: [],
  automation_history: [],
  allowed_emails: [],
  expenses_admins: [],
});

beforeEach(() => {
  sb = createSupabaseMock(seedBase());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Routing por rol — cada rol llega a su vista', () => {
  it('ADMIN (allowed_emails de DB) → pantalla de elección de panel', async () => {
    sb.store.allowed_emails.push({ email: 'admin.db@example.com' });
    sb.setSession(sessionFor('admin.db@example.com'));

    render(createElement(App));

    expect(await screen.findByText('Panel de Administración', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Panel de Expensas')).toBeInTheDocument();
  });

  it('EXPENSES_ADMIN (expenses_admins activos) → portal de expensas', async () => {
    sb.store.expenses_admins.push({ email: 'nora@example.com', active: true });
    sb.setSession(sessionFor('nora@example.com', 'uid-nora'));

    render(createElement(App));

    expect(await screen.findByText('PORTAL_EXPENSAS', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('TENANT → portal de inquilino (tolera email con mayúsculas y duplicados — Lección 9/10)', async () => {
    // Email almacenado con mayúsculas + fila duplicada: el lookup usa
    // .ilike() + .limit(1).maybeSingle(), así que igual resuelve TENANT.
    sb.store.tenants.push(
      { id: 't1', name: 'Inquilino Uno', email: 'Inquilino@Example.com', property_id: null, user_id: null },
      { id: 't2', name: 'Inquilino Dup', email: 'inquilino@example.com', property_id: null, user_id: null }
    );
    sb.setSession(sessionFor('inquilino@example.com', 'uid-tenant'));

    render(createElement(App));

    expect(await screen.findByText('PORTAL_INQUILINO', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('Email no registrado → acceso denegado: cierra sesión y vuelve al login', async () => {
    sb.setSession(sessionFor('desconocido@example.com', 'uid-x'));

    render(createElement(App));

    // AuthScreen vuelve a mostrarse y se llamó signOut.
    expect(await screen.findByText('Continuar con Google', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(sb.spies.signOut).toHaveBeenCalled());
  });
});
