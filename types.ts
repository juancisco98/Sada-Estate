
export enum PropertyStatus {
  CURRENT = 'CURRENT', // Al día (Verde)
  LATE = 'LATE', // Moroso (Rojo)
  WARNING = 'WARNING', // Próximo a vencer / Vacante (Amarillo)
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string; // Hex color for visual differentiation
  password?: string; // Simple mock password
}

export interface Building {
  id: string;
  address: string;
  coordinates: [number, number];
  country: string;
  currency: string;
  imageUrl?: string;
  notes?: string;
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
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId: string | null;
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

export type VoiceIntent =
  | 'REGISTER_EXPENSE'
  | 'UPDATE_PROPERTY'
  | 'CALL_CONTACT'
  | 'NAVIGATE'
  | 'SEARCH_MAP'
  | 'GENERAL_QUERY'
  | 'EXPLAIN_SCREEN'
  | 'SELECT_ITEM'
  | 'STOP_LISTENING'
  | 'UNKNOWN';

export interface VoiceCommandResponse {
  intent: VoiceIntent;
  responseText: string;
  requiresFollowUp?: boolean;
  data?: {
    propertyId?: string;
    professionalId?: string;
    searchQuery?: string;
    itemType?: 'PROPERTY' | 'PROFESSIONAL';
    targetView?: 'MAP' | 'OVERVIEW' | 'FINANCE' | 'PROFESSIONALS' | 'TENANTS' | 'ADD_PROPERTY_MODAL' | 'ADD_PRO_MODAL';
    amount?: number;
    description?: string;
    actionType?:
    | 'CHANGE_RENT'
    | 'ASSIGN_PROFESSIONAL'
    | 'CHANGE_TENANT'
    | 'CREATE_NOTE'
    | 'SET_VALUE'
    | 'FINISH_MAINTENANCE'
    | 'CREATE_NEW';
    newRent?: number;
    newTenant?: string;
    professionalName?: string;
    noteContent?: string;
    field?: string;
    value?: string | number | boolean;
    phoneNumber?: string;
    contactName?: string;
    coordinates?: [number, number];
    address?: string;
  };
}

// Web Speech API Types
export interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}
