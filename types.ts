
export enum PropertyStatus {
  CURRENT = 'CURRENT', // Al día (Verde)
  LATE = 'LATE', // Moroso (Rojo)
  WARNING = 'WARNING', // Próximo a vencer / Vacante (Amarillo)
}

export type PropertyType = 'casa' | 'edificio' | 'local';

export interface User {
  id: string;
  name: string;
  email: string;
  color?: string; // Hex color for visual differentiation
  photoURL?: string;
  role?: 'ADMIN' | 'TENANT' | 'EXPENSES_ADMIN'; // Identificar si es admin (familia), inquilino, o admin de expensas
}

export interface Building {
  id: string;
  address: string;
  coordinates: [number, number];
  country: string;
  currency: string;
  imageUrl?: string;
  notes?: string;
  userId?: string;
}

export interface Property {
  id: string;
  address: string;
  tenantName: string;
  tenantPhone?: string;
  imageUrl?: string;
  status: PropertyStatus;
  monthlyRent: number;
  coordinates: [number, number]; // Lat, Lng
  contractEnd: string;
  lastPaymentDate: string;
  assignedProfessionalId?: string;
  professionalAssignedDate?: string;
  maintenanceTaskDescription?: string;
  notes?: string;
  lastModifiedBy?: string;
  rooms?: number;
  squareMeters?: number;
  country: string;
  currency: string;
  exchangeRate?: number;
  // Building / Unit
  buildingId?: string;
  unitLabel?: string;
  propertyType: PropertyType;
  userId?: string;
  contractStart?: string;
  adjustmentMonths?: number;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId: string | null;
  userId?: string;
}

export interface TenantPayment {
  id: string;
  tenantId: string;
  propertyId: string | null;
  amount: number;
  currency: string;
  month: number; // 1-12
  year: number;
  paidOnTime: boolean;
  paymentDate: string;
  paymentMethod?: 'CASH' | 'TRANSFER';
  proofOfPayment?: string; // Comprobante de alquiler
  proofOfExpenses?: string; // Comprobante de expensas
  expenseAmount?: number; // Monto de expensas (separado del alquiler)
  status?: 'PENDING' | 'REVISION' | 'APPROVED' | 'RETURNED'; // Estado de la revisión
  notes?: string;
  userId?: string;
}

export interface Professional {
  id: string;
  name: string;
  profession: string; // Gasista, Plomero, etc.
  rating: number; // 1-5
  speedRating: number; // 1-5 (Rapidez)
  zone: string;
  phone: string;
  reviews?: {
    rating: number;
    comment: string;
    date: string;
  }[];
  userId?: string;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface MaintenanceTask {
  id: string;
  propertyId: string;
  professionalId: string;
  description: string;
  status: TaskStatus;
  startDate: string;
  estimatedCost: number;
  cost?: number; // Final cost in USD
  endDate?: string;
  partialExpenses?: PartialExpense[];
  userId?: string;
}

export interface PartialExpense {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string
  by: string; // User who added it
  proofUrl?: string; // URL to uploaded receipt/proof
}

export interface ExpenseLog {
  id: string;
  propertyId: string;
  professionalId?: string;
  professionalName?: string;
  amount: number;
  description: string;
  date: string;
  confirmed: boolean;
}

export interface ParsedExpenseLineItem {
  concept: string;
  amount: number;
}

export interface ParsedExpenseSheet {
  period?: string;                  // ej. "ENERO 2026"
  items: ParsedExpenseLineItem[];   // conceptos + montos (sin la fila TOTAL)
  total: number;
  currency?: string;                // "ARS" por defecto
}

export interface ExpenseSheet {
  id: string;
  tenantId: string;
  month: number;
  year: number;
  sheetData: any[][];   // filas × columnas del Excel (raw, archival). [] si sourceType=pdf
  sheetName: string;
  uploadedAt: string;
  uploadedBy: string;
  parsedData?: ParsedExpenseSheet; // estructurado prolijo para mostrar al inquilino
  sourceType?: 'excel' | 'pdf';    // origen de la liquidación
  pdfUrl?: string;                  // URL del PDF en Storage (solo si sourceType=pdf)
}

export interface ExpensesAdmin {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  deactivatedAt: string | null;
}

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: 'PAYMENT_SUBMITTED' | 'PAYMENT_APPROVED' | 'PAYMENT_REVISION' | 'PAYMENT_RETURNED'
    | 'AUTOMATION_PROPOSED' | 'AUTOMATION_EXECUTED' | 'AUTOMATION_UNDONE';
  paymentId?: string;
  read: boolean;
  createdAt: string;
}

// ========== REMINDERS ==========

export type ReminderEntityType = 'property' | 'tenant' | 'professional' | 'maintenance_task';

export interface ManualReminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate: string;
  entityType?: ReminderEntityType;
  entityId?: string;
  completed: boolean;
  createdAt: string;
}

export type SmartReminderType =
  | 'CONTRACT_EXPIRY'
  | 'RENT_ADJUSTMENT_DUE'
  | 'MAINTENANCE_STALE'
  | 'PAYMENT_REVISION_STALE'
  | 'PAYMENT_OVERDUE'
  | 'AI_GENERATED'
  | 'MANUAL';

export interface SmartReminder {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  type: SmartReminderType;
  source: 'manual' | 'auto' | 'ai';
  entityType?: ReminderEntityType;
  entityId?: string;
  completed: boolean;
  urgency: 'overdue' | 'urgent' | 'upcoming' | 'done';
  createdAt?: string;
}

// ========== AUTOMATION ==========

export type AutomationActionType =
  | 'PAYMENT_REGISTERED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_RETURNED'
  | 'MAINTENANCE_COMPLETED'
  | 'RENT_UPDATED'
  | 'REMINDER_COMPLETED'
  | 'TENANT_CREATED'
  | 'TENANT_DELETED'
  | 'PROFESSIONAL_ASSIGNED'
  | 'PROPERTY_CREATED'
  | 'PROPERTY_DELETED';

export type AutomationRuleType =
  | 'AUTO_APPROVE_PAYMENT'
  | 'AUTO_REGISTER_PAYMENT'
  | 'AUTO_UPDATE_RENT'
  | 'AUTO_REMIND';

export type AutomationStatus = 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'UNDONE' | 'REJECTED';

export interface AdminActionLog {
  id: string;
  userEmail: string;
  actionType: AutomationActionType;
  entityTable: string;
  entityId?: string;
  actionPayload: Record<string, unknown>;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  ruleType: AutomationRuleType;
  conditions: Record<string, unknown>;
  enabled: boolean;
  requiresApproval: boolean;
  confidenceThreshold: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationHistoryEntry {
  id: string;
  ruleId?: string;
  actionType: string;
  entityTable: string;
  entityId?: string;
  status: AutomationStatus;
  actionPayload: Record<string, unknown>;
  undoPayload?: Record<string, unknown>;
  confidence?: number;
  description?: string;
  proposedAt: string;
  executedAt?: string;
  executedBy?: string;
  undoneAt?: string;
  undoneBy?: string;
}

