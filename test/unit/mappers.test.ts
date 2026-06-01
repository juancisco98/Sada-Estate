import { describe, it, expect } from 'vitest';
import {
  dbToProperty,
  propertyToDb,
  dbToTenant,
  tenantToDb,
  dbToPayment,
  paymentToDb,
  dbToBuilding,
  buildingToDb,
  dbToProfessional,
  professionalToDb,
  dbToTask,
  taskToDb,
  dbToExpenseSheet,
  expenseSheetToDb,
} from '@/utils/mappers';
import type {
  DbPropertyRow,
  DbTenantPaymentRow,
  DbTenantRow,
  DbMaintenanceTaskRow,
} from '@/types/dbRows';
import type {
  Property,
  Tenant,
  TenantPayment,
  Building,
  Professional,
  MaintenanceTask,
  ExpenseSheet,
} from '@/types';
import { PropertyStatus, TaskStatus } from '@/types';

describe('mappers DB (snake_case) ↔ App (camelCase)', () => {
  describe('property', () => {
    const dbRow: DbPropertyRow = {
      id: 'p1',
      address: 'Vélez Sársfield 134',
      tenant_name: 'Juan Pérez',
      tenant_phone: '111',
      image_url: 'http://img',
      status: 'CURRENT',
      monthly_rent: '4357099', // viene como string desde Postgres numeric
      coordinates: [-34.6, -58.4],
      contract_end: '2026-12-31',
      last_payment_date: '2026-05-01',
      country: 'AR',
      currency: 'ARS',
      square_meters: '55',
      exchange_rate: '1200',
    };

    it('dbToProperty coacciona numeric strings a number', () => {
      const p = dbToProperty(dbRow);
      expect(p.monthlyRent).toBe(4357099);
      expect(typeof p.monthlyRent).toBe('number');
      expect(p.squareMeters).toBe(55);
      expect(p.exchangeRate).toBe(1200);
    });

    it('deriva propertyType = "casa" sin building_id y "edificio" con building_id', () => {
      expect(dbToProperty(dbRow).propertyType).toBe('casa');
      expect(dbToProperty({ ...dbRow, building_id: 'b1' }).propertyType).toBe('edificio');
    });

    it('respeta property_type explícito por encima de la derivación', () => {
      expect(dbToProperty({ ...dbRow, property_type: 'local' }).propertyType).toBe('local');
    });

    it('round-trip property → db → property preserva los campos clave', () => {
      const app: Property = dbToProperty(dbRow);
      const back = dbToProperty({ ...dbRow, ...(propertyToDb(app) as Partial<DbPropertyRow>) });
      expect(back.id).toBe(app.id);
      expect(back.address).toBe(app.address);
      expect(back.tenantName).toBe(app.tenantName);
      expect(back.monthlyRent).toBe(app.monthlyRent);
      expect(back.status).toBe(PropertyStatus.CURRENT);
    });
  });

  describe('tenant', () => {
    it('tenantToDb normaliza el email a minúsculas (convención de emails)', () => {
      const t: Tenant = {
        id: 't1',
        name: 'Nora',
        phone: '222',
        email: 'Nora.Test@Gmail.com',
        propertyId: 'p1',
        userId: 'u1',
      };
      expect(tenantToDb(t).email).toBe('nora.test@gmail.com');
    });

    it('dbToTenant convierte null en strings vacíos para phone/email', () => {
      const row: DbTenantRow = { id: 't1', name: 'X', phone: null, email: null, property_id: null };
      const t = dbToTenant(row);
      expect(t.phone).toBe('');
      expect(t.email).toBe('');
    });
  });

  describe('payment', () => {
    const row: DbTenantPaymentRow = {
      id: 'pay1',
      tenant_id: 't1',
      property_id: 'p1',
      amount: '4000000',
      currency: 'ARS',
      month: 5,
      year: 2026,
      paid_on_time: true,
      payment_date: '2026-05-03',
      payment_method: 'TRANSFER',
      expense_amount: 15000,
      status: 'APPROVED',
    };

    it('dbToPayment coacciona amount y mapea status/expenseAmount', () => {
      const p = dbToPayment(row);
      expect(p.amount).toBe(4000000);
      expect(p.status).toBe('APPROVED');
      expect(p.expenseAmount).toBe(15000);
      expect(p.paymentMethod).toBe('TRANSFER');
    });

    it('payment_method ausente cae a CASH', () => {
      expect(dbToPayment({ ...row, payment_method: null }).paymentMethod).toBe('CASH');
    });

    it('round-trip payment → db → payment preserva status y montos', () => {
      const app: TenantPayment = dbToPayment(row);
      const back = dbToPayment({ ...row, ...(paymentToDb(app) as Partial<DbTenantPaymentRow>) });
      expect(back.status).toBe('APPROVED');
      expect(back.amount).toBe(4000000);
      expect(back.expenseAmount).toBe(15000);
    });
  });

  describe('building y professional round-trip', () => {
    it('building preserva id/address/coordinates/currency', () => {
      const b: Building = {
        id: 'b1',
        address: 'Av. Corrientes 1000',
        coordinates: [-34.6, -58.38],
        country: 'AR',
        currency: 'ARS',
      };
      const back = dbToBuilding({ ...(buildingToDb(b) as any) });
      expect(back).toMatchObject({ id: 'b1', address: 'Av. Corrientes 1000', currency: 'ARS' });
      expect(back.coordinates).toEqual([-34.6, -58.38]);
    });

    it('professional coacciona ratings a number', () => {
      const prof: Professional = {
        id: 'pr1',
        name: 'Plomero',
        profession: 'Plomería',
        rating: 4.5,
        speedRating: 4,
        zone: 'CABA',
        phone: '333',
        reviews: [],
      };
      const back = dbToProfessional({ ...(professionalToDb(prof) as any) });
      expect(back.rating).toBe(4.5);
      expect(back.speedRating).toBe(4);
      expect(typeof back.rating).toBe('number');
    });
  });

  describe('maintenance task', () => {
    const row: DbMaintenanceTaskRow = {
      id: 'task1',
      property_id: 'p1',
      professional_id: 'pr1',
      description: 'Arreglar caño',
      status: 'IN_PROGRESS',
      start_date: '2026-05-01',
      estimated_cost: '50000',
      cost: '48000',
    };

    it('dbToTask coacciona costos a number y mapea status', () => {
      const t = dbToTask(row);
      expect(t.estimatedCost).toBe(50000);
      expect(t.cost).toBe(48000);
      expect(t.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('round-trip task → db → task preserva costos y status', () => {
      const app: MaintenanceTask = dbToTask(row);
      const back = dbToTask({ ...row, ...(taskToDb(app) as Partial<DbMaintenanceTaskRow>) });
      expect(back.estimatedCost).toBe(50000);
      expect(back.cost).toBe(48000);
      expect(back.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('expense sheet (caso PDF — Lección 16)', () => {
    it('liquidación PDF: parsedData.total = 0 lo completa el inquilino', () => {
      const sheet: Omit<ExpenseSheet, 'id'> = {
        tenantId: 't1',
        month: 5,
        year: 2026,
        sheetName: 'Mayo.pdf',
        uploadedAt: '2026-05-01',
        uploadedBy: 'nora@x.com',
        sourceType: 'pdf',
        pdfUrl: 'http://storage/mayo.pdf',
        parsedData: { items: [], total: 0, currency: 'ARS' },
      };
      const dbRow = expenseSheetToDb(sheet);
      expect(dbRow.source_type).toBe('pdf');
      expect(dbRow.pdf_url).toBe('http://storage/mayo.pdf');

      const back = dbToExpenseSheet({ id: 's1', ...(dbRow as any) });
      expect(back.sourceType).toBe('pdf');
      expect(back.parsedData?.total).toBe(0);
      expect(back.pdfUrl).toBe('http://storage/mayo.pdf');
    });

    it('default sourceType = "excel" cuando no se especifica', () => {
      const back = dbToExpenseSheet({ id: 's2', tenant_id: 't1', month: 1, year: 2026 });
      expect(back.sourceType).toBe('excel');
    });
  });
});
