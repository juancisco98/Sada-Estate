import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { render as rtlRender } from '@testing-library/react';
import { createSupabaseMock, getActiveSupabaseClient } from '../mocks/supabase';
import { ThemeProvider } from '@/context/ThemeContext';
import type { User } from '@/types';

vi.mock('@/services/supabaseClient', () => ({
  get supabase() {
    return getActiveSupabaseClient();
  },
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}));

// DataContext mockeado: provider passthrough + value completo y vacío.
const noop = () => {};
const ctxValue = {
  properties: [],
  setProperties: noop,
  professionals: [],
  setProfessionals: noop,
  maintenanceTasks: [],
  setMaintenanceTasks: noop,
  buildings: [],
  setBuildings: noop,
  tenants: [],
  setTenants: noop,
  payments: [],
  setPayments: noop,
  expenseSheets: [],
  setExpenseSheets: noop,
  reminders: [],
  setReminders: noop,
  automationRules: [],
  setAutomationRules: noop,
  automationHistory: [],
  setAutomationHistory: noop,
  notifications: [],
  unreadCount: 0,
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  isLoading: false,
  refreshData: vi.fn().mockResolvedValue(undefined),
  loadExpenseSheetData: vi.fn().mockResolvedValue([]),
};
vi.mock('@/context/DataContext', () => ({
  DataProvider: ({ children }: { children: ReactNode }) => children,
  useDataContext: () => ctxValue,
}));

import { OverviewView, FinanceView, ProfessionalsView } from '@/components/DashboardViews';
import TenantsView from '@/components/TenantsView';
import RemindersView from '@/components/RemindersView';
import AdminSettings from '@/components/AdminSettings';
import TenantPortal from '@/components/TenantPortal';
import ExpensesAdminPortal from '@/components/ExpensesAdminPortal';
import MapBoard from '@/components/MapBoard';

const emptyMetrics = {
  totalPaid: 0,
  totalExpenses: 0,
  totalPayments: 0,
  onTimePayments: 0,
  onTimeRate: 0,
  monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0, paid: false })),
  expenseMonthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0, paid: false })),
  currency: 'ARS',
};

const adminUser: User = {
  id: 'u1',
  name: 'Admin Test',
  email: 'admin@example.com',
  role: 'ADMIN',
};

// Varias vistas usan useTheme (dark mode) → necesitan ThemeProvider.
const renderWithTheme = (node: ReactNode) =>
  rtlRender(createElement(ThemeProvider, { children: node }));

beforeEach(() => {
  createSupabaseMock({
    tenants: [],
    tenant_payments: [],
    properties: [],
    expense_sheets: [],
    notifications: [],
    allowed_emails: [],
    expenses_admins: [],
  });
});

describe('Smoke render — vistas principales montan sin crashear', () => {
  it('MapBoard (vista MAP) monta con Leaflet en jsdom', () => {
    const { container } = renderWithTheme(
      createElement(MapBoard, { properties: [], onPropertySelect: noop })
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('OverviewView monta con datos vacíos', () => {
    const { container } = renderWithTheme(createElement(OverviewView));
    expect(container).toBeTruthy();
  });

  it('FinanceView monta con datos vacíos', () => {
    const { container } = renderWithTheme(createElement(FinanceView));
    expect(container).toBeTruthy();
  });

  it('ProfessionalsView monta con datos vacíos', () => {
    const { container } = renderWithTheme(createElement(ProfessionalsView));
    expect(container).toBeTruthy();
  });

  it('TenantsView monta con props mínimas', () => {
    const { container } = renderWithTheme(
      createElement(TenantsView, {
        tenants: [],
        payments: [],
        properties: [],
        onSaveTenant: noop,
        onDeleteTenant: noop,
        onRegisterPayment: noop,
        onUpdatePayment: noop,
        onDeletePayment: vi.fn().mockResolvedValue(undefined),
        maintenanceTasks: [],
        refreshData: vi.fn().mockResolvedValue(undefined),
        getTenantMetrics: () => emptyMetrics,
      })
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('RemindersView monta con props mínimas', () => {
    const { container } = renderWithTheme(
      createElement(RemindersView, {
        smartReminders: [],
        onAnalyzeAI: vi.fn().mockResolvedValue(undefined),
        isAnalyzing: false,
        lastAnalysis: null,
        properties: [],
        tenants: [],
        professionals: [],
        maintenanceTasks: [],
      })
    );
    expect(container).toBeTruthy();
  });

  it('AdminSettings monta (usa DataContext + supabase mockeados)', () => {
    const { container } = renderWithTheme(createElement(AdminSettings));
    expect(container).toBeTruthy();
  });

  it('TenantPortal monta (portal pre-lanzamiento)', () => {
    const { container } = renderWithTheme(
      createElement(TenantPortal, { currentUser: { ...adminUser, role: 'TENANT' }, onLogout: noop })
    );
    expect(container).toBeTruthy();
  });

  it('ExpensesAdminPortal monta (portal pre-lanzamiento)', () => {
    const { container } = renderWithTheme(
      createElement(ExpensesAdminPortal, {
        currentUser: { ...adminUser, role: 'EXPENSES_ADMIN' },
        onLogout: noop,
        onSwitchMode: noop,
      })
    );
    expect(container).toBeTruthy();
  });
});
