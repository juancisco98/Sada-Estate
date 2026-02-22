
export enum PropertyStatus {
  CURRENT = 'CURRENT', // Al día (Verde)
  LATE = 'LATE', // Moroso (Rojo)
  WARNING = 'WARNING', // Próximo a vencer / Vacante (Amarillo)
}

export interface User {
  id: string;
  name: string;
  email: string;
  color?: string; // Hex color for visual differentiation
  photoURL?: string;
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
  userId?: string;
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
  proofOfPayment?: string;
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

