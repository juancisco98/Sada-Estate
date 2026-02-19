import { Property, Professional, MaintenanceTask, Building, PropertyStatus, TaskStatus } from '../types';

// ========== BUILDING MAPPERS ==========

export const dbToBuilding = (row: any): Building => ({
    id: row.id,
    address: row.address,
    coordinates: row.coordinates as [number, number],
    country: row.country,
    currency: row.currency,
    imageUrl: row.image_url,
    notes: row.notes,
});

export const buildingToDb = (b: Building): Record<string, any> => ({
    id: b.id,
    address: b.address,
    coordinates: b.coordinates,
    country: b.country,
    currency: b.currency,
    image_url: b.imageUrl || null,
    notes: b.notes || null,
});

// ========== MAPPERS: DB (snake_case) <-> App (camelCase) ==========

export const dbToProperty = (row: any): Property => ({
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
});

export const propertyToDb = (p: Property): Record<string, any> => ({
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
});

export const dbToProfessional = (row: any): Professional => ({
    id: row.id,
    name: row.name,
    profession: row.profession,
    rating: Number(row.rating),
    speedRating: Number(row.speed_rating),
    zone: row.zone,
    phone: row.phone,
    reviews: row.reviews || [],
});

export const professionalToDb = (p: Professional): Record<string, any> => ({
    id: p.id,
    name: p.name,
    profession: p.profession,
    rating: p.rating,
    speed_rating: p.speedRating,
    zone: p.zone,
    phone: p.phone,
    reviews: p.reviews || [],
});

export const dbToTask = (row: any): MaintenanceTask => ({
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
});

export const taskToDb = (t: MaintenanceTask): Record<string, any> => ({
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
});
