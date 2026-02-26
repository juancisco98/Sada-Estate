import { Property, Professional, MaintenanceTask, Building, PropertyStatus, TaskStatus, Tenant, TenantPayment } from '../types';
import {
    DbBuildingRow,
    DbPropertyRow,
    DbProfessionalRow,
    DbMaintenanceTaskRow,
    DbTenantRow,
    DbTenantPaymentRow
} from '../types/dbRows';

// ========== BUILDING MAPPERS ==========

export const dbToBuilding = (row: DbBuildingRow): Building => ({
    id: row.id,
    address: row.address,
    coordinates: row.coordinates as [number, number],
    country: row.country,
    currency: row.currency,
    imageUrl: row.image_url,
    notes: row.notes,
    userId: row.user_id,
});

export const buildingToDb = (b: Building): Record<string, unknown> => ({
    id: b.id,
    address: b.address,
    coordinates: b.coordinates,
    country: b.country,
    currency: b.currency,
    image_url: b.imageUrl || null,
    notes: b.notes || null,
    user_id: b.userId || undefined,
});

// ========== MAPPERS: DB (snake_case) <-> App (camelCase) ==========

export const dbToProperty = (row: DbPropertyRow): Property => ({
    id: row.id,
    address: row.address,
    tenantName: row.tenant_name,
    tenantPhone: row.tenant_phone,
    imageUrl: row.image_url,
    status: row.status as PropertyStatus,
    monthlyRent: Number(row.monthly_rent),
    coordinates: row.coordinates as [number, number],
    contractEnd: row.contract_end,
    lastPaymentDate: row.last_payment_date,
    assignedProfessionalId: row.assigned_professional_id,
    professionalAssignedDate: row.professional_assigned_date,
    maintenanceTaskDescription: row.maintenance_task_description,
    notes: row.notes,
    lastModifiedBy: row.last_modified_by,
    rooms: row.rooms,
    squareMeters: row.square_meters ? Number(row.square_meters) : undefined,
    country: row.country,
    currency: row.currency,
    exchangeRate: row.exchange_rate ? Number(row.exchange_rate) : undefined,
    buildingId: row.building_id || undefined,
    unitLabel: row.unit_label || undefined,
    userId: row.user_id,
});

export const propertyToDb = (p: Property): Record<string, unknown> => ({
    id: p.id,
    address: p.address,
    tenant_name: p.tenantName,
    tenant_phone: p.tenantPhone,
    image_url: p.imageUrl,
    status: p.status,
    monthly_rent: p.monthlyRent,
    coordinates: p.coordinates,
    contract_end: p.contractEnd,
    last_payment_date: p.lastPaymentDate,
    assigned_professional_id: p.assignedProfessionalId || null,
    professional_assigned_date: p.professionalAssignedDate || null,
    maintenance_task_description: p.maintenanceTaskDescription || null,
    notes: p.notes || null,
    last_modified_by: p.lastModifiedBy || null,
    rooms: p.rooms || null,
    square_meters: p.squareMeters || null,
    country: p.country,
    currency: p.currency,
    exchange_rate: p.exchangeRate || null,
    building_id: p.buildingId || null,
    unit_label: p.unitLabel || '',
    user_id: p.userId || undefined,
});

export const dbToProfessional = (row: DbProfessionalRow): Professional => ({
    id: row.id,
    name: row.name,
    profession: row.profession,
    rating: Number(row.rating),
    speedRating: Number(row.speed_rating),
    zone: row.zone,
    phone: row.phone,
    reviews: row.reviews || [],
    userId: row.user_id,
});

export const professionalToDb = (p: Professional): Record<string, unknown> => ({
    id: p.id,
    name: p.name,
    profession: p.profession,
    rating: p.rating,
    speed_rating: p.speedRating,
    zone: p.zone,
    phone: p.phone,
    reviews: p.reviews || [],
    user_id: p.userId || undefined,
});

export const dbToTask = (row: DbMaintenanceTaskRow): MaintenanceTask => ({
    id: row.id,
    propertyId: row.property_id,
    professionalId: row.professional_id,
    description: row.description,
    status: row.status as TaskStatus,
    startDate: row.start_date,
    estimatedCost: Number(row.estimated_cost),
    cost: row.cost ? Number(row.cost) : undefined,
    endDate: row.end_date || undefined,
    partialExpenses: row.partial_expenses || [],
    userId: row.user_id,
});

export const taskToDb = (t: MaintenanceTask): Record<string, unknown> => ({
    id: t.id,
    property_id: t.propertyId,
    professional_id: t.professionalId,
    description: t.description,
    status: t.status,
    start_date: t.startDate,
    estimated_cost: t.estimatedCost,
    cost: t.cost || null,
    end_date: t.endDate || null,
    partial_expenses: t.partialExpenses || [],
    user_id: t.userId || undefined,
});

// ========== TENANT MAPPERS ==========

export const dbToTenant = (row: DbTenantRow): Tenant => ({
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    propertyId: row.property_id,
    userId: row.user_id,
});

export const tenantToDb = (t: Tenant): Record<string, unknown> => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    email: t.email,
    property_id: t.propertyId || null,
    user_id: t.userId || undefined,
});

export const dbToPayment = (row: DbTenantPaymentRow): TenantPayment => ({
    id: row.id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    amount: Number(row.amount),
    currency: row.currency,
    month: row.month,
    year: row.year,
    paidOnTime: row.paid_on_time,
    paymentDate: row.payment_date,
    paymentMethod: (row.payment_method as 'CASH' | 'TRANSFER') || 'CASH',
    proofOfPayment: row.proof_of_payment ?? undefined,
    notes: row.notes ?? undefined,
    userId: row.user_id ?? undefined,
});

export const paymentToDb = (p: TenantPayment): Record<string, unknown> => ({
    id: p.id,
    tenant_id: p.tenantId,
    property_id: p.propertyId || null,
    amount: p.amount,
    currency: p.currency,
    month: p.month,
    year: p.year,
    paid_on_time: p.paidOnTime,
    payment_date: p.paymentDate,
    payment_method: p.paymentMethod,
    proof_of_payment: p.proofOfPayment,
    notes: p.notes,
    user_id: p.userId || undefined,
});
