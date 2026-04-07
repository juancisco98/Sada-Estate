import { Property, Professional, MaintenanceTask, Building, PropertyStatus, TaskStatus, Tenant, TenantPayment, PropertyType, ExpenseSheet, ManualReminder, ReminderEntityType, AdminActionLog, AutomationRule, AutomationHistoryEntry, AutomationActionType, AutomationRuleType, AutomationStatus } from '../types';
import {
    DbBuildingRow,
    DbPropertyRow,
    DbProfessionalRow,
    DbMaintenanceTaskRow,
    DbTenantRow,
    DbTenantPaymentRow,
    DbExpenseSheetRow,
    DbReminderRow,
    DbAdminActionLogRow,
    DbAutomationRuleRow,
    DbAutomationHistoryRow
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
    propertyType: (row.property_type as PropertyType) || (row.building_id ? 'edificio' : 'casa'),
    userId: row.user_id,
    contractStart: row.contract_start || undefined,
    adjustmentMonths: row.adjustment_months || undefined,
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
    property_type: p.propertyType || 'casa',
    user_id: p.userId || undefined,
    contract_start: p.contractStart || null,
    adjustment_months: p.adjustmentMonths || null,
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
    email: t.email?.toLowerCase() || '',
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
    proofOfExpenses: row.proof_of_expenses ?? undefined,
    expenseAmount: row.expense_amount ? Number(row.expense_amount) : undefined,
    status: (row.status as 'PENDING' | 'REVISION' | 'APPROVED') ?? undefined,
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
    proof_of_expenses: p.proofOfExpenses,
    expense_amount: p.expenseAmount ?? null,
    status: p.status,
    notes: p.notes,
    user_id: p.userId || undefined,
});

// ========== EXPENSE SHEET MAPPERS ==========

export const dbToExpenseSheet = (row: DbExpenseSheetRow): ExpenseSheet => ({
    id: row.id,
    tenantId: row.tenant_id,
    month: row.month,
    year: row.year,
    sheetData: row.sheet_data,
    sheetName: row.sheet_name || '',
    uploadedAt: row.uploaded_at || '',
    uploadedBy: row.uploaded_by || '',
    parsedData: row.parsed_data || undefined,
});

export const expenseSheetToDb = (s: Omit<ExpenseSheet, 'id'> & { id?: string }): Omit<DbExpenseSheetRow, 'id'> & { id?: string } => ({
    ...(s.id ? { id: s.id } : {}),
    tenant_id: s.tenantId,
    month: s.month,
    year: s.year,
    sheet_data: s.sheetData,
    sheet_name: s.sheetName,
    uploaded_by: s.uploadedBy,
    parsed_data: s.parsedData ?? null,
});

// ========== REMINDER MAPPERS ==========

export const dbToReminder = (row: DbReminderRow): ManualReminder => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date,
    entityType: (row.entity_type as ReminderEntityType) ?? undefined,
    entityId: row.entity_id ?? undefined,
    completed: row.completed,
    createdAt: row.created_at || '',
});

export const reminderToDb = (r: ManualReminder): Record<string, unknown> => ({
    id: r.id,
    user_id: r.userId,
    title: r.title,
    description: r.description || null,
    due_date: r.dueDate,
    entity_type: r.entityType || null,
    entity_id: r.entityId || null,
    completed: r.completed,
});

// ========== AUTOMATION MAPPERS ==========

export const dbToActionLog = (row: DbAdminActionLogRow): AdminActionLog => ({
    id: row.id,
    userEmail: row.user_email,
    actionType: row.action_type as AutomationActionType,
    entityTable: row.entity_table,
    entityId: row.entity_id ?? undefined,
    actionPayload: row.action_payload,
    context: row.context ?? undefined,
    createdAt: row.created_at || '',
});

export const dbToAutomationRule = (row: DbAutomationRuleRow): AutomationRule => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ruleType: row.rule_type as AutomationRuleType,
    conditions: row.conditions,
    enabled: row.enabled,
    requiresApproval: row.requires_approval,
    confidenceThreshold: Number(row.confidence_threshold),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
});

export const automationRuleToDb = (r: AutomationRule): Record<string, unknown> => ({
    id: r.id,
    name: r.name,
    description: r.description || null,
    rule_type: r.ruleType,
    conditions: r.conditions,
    enabled: r.enabled,
    requires_approval: r.requiresApproval,
    confidence_threshold: r.confidenceThreshold,
    created_by: r.createdBy || null,
});

export const dbToAutomationHistory = (row: DbAutomationHistoryRow): AutomationHistoryEntry => ({
    id: row.id,
    ruleId: row.rule_id ?? undefined,
    actionType: row.action_type,
    entityTable: row.entity_table,
    entityId: row.entity_id ?? undefined,
    status: row.status as AutomationStatus,
    actionPayload: row.action_payload,
    undoPayload: row.undo_payload ?? undefined,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    description: row.description ?? undefined,
    proposedAt: row.proposed_at || '',
    executedAt: row.executed_at ?? undefined,
    executedBy: row.executed_by ?? undefined,
    undoneAt: row.undone_at ?? undefined,
    undoneBy: row.undone_by ?? undefined,
});
