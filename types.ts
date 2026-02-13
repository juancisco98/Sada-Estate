
export enum PropertyStatus {
  CURRENT = 'CURRENT', // Al día (Verde)
  LATE = 'LATE', // Moroso (Rojo)
  WARNING = 'WARNING', // Próximo a vencer / Vacante (Amarillo)
}

export interface TaxInfo {
  // Argentina
  abl?: number; // Alumbrado, Barrido y Limpieza (ARS)
  rentas?: number; // Impuesto Inmobiliario (ARS)
  water?: number; // AySA / Aguas (ARS)
  // USA
  propertyTax?: number; // Annual Property Tax / 12 (USD)
  hoa?: number; // Homeowners Association (USD)
  insurance?: number; // Property Insurance (USD)
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string; // Hex color for visual differentiation
  password?: string; // Simple mock password
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
  assignedProfessionalId?: string; // Nuevo: Profesional asignado
  professionalAssignedDate?: string; // Nuevo: Fecha de inicio de asignación/obra
  maintenanceTaskDescription?: string; // Nuevo: Descripción de la tarea (ej: Pintura, Gas)
  notes?: string; // Nuevo: Notas recordatorias del propietario
  valuation?: number; // Valor estimado de venta
  taxInfo?: TaxInfo; // Nuevo: Información de impuestos
  suggestedRent?: number; // Nuevo: Alquiler sugerido por IA
  lastModifiedBy?: string; // ID del usuario que modificó por última vez
  rooms?: number; // Nuevo: Cantidad de ambientes
  squareMeters?: number; // Nuevo: Metros cuadrados totales
  country: string; // Nuevo: País de la propiedad (ej: 'Argentina', 'USA')
  currency: string; // Nuevo: Moneda local (ej: 'ARS', 'USD')
  exchangeRate?: number; // Nuevo: Tipo de cambio específico (opcional)
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
  professionalId?: string; // Optional if generic expense
  professionalName?: string; // For display if ID not found immediately
  amount: number;
  description: string;
  date: string;
  confirmed: boolean;
}

export type VoiceIntent =
  | 'REGISTER_EXPENSE'
  | 'UPDATE_PROPERTY' // Create/Edit/Delete logic
  | 'CALL_CONTACT'
  | 'NAVIGATE'
  | 'SEARCH_MAP'
  | 'GENERAL_QUERY'
  | 'EXPLAIN_SCREEN' // Context aware help
  | 'SELECT_ITEM' // Select a property or pro by name
  | 'STOP_LISTENING' // Exit command
  | 'UNKNOWN';

export interface VoiceCommandResponse {
  intent: VoiceIntent;
  responseText: string;
  requiresFollowUp?: boolean;
  data?: {
    // Shared / Context
    propertyId?: string;
    professionalId?: string;

    // Search / Select
    searchQuery?: string;
    itemType?: 'PROPERTY' | 'PROFESSIONAL';

    // Forms / Modals
    targetView?: 'MAP' | 'OVERVIEW' | 'FINANCE' | 'PROFESSIONALS' | 'ADD_PROPERTY_MODAL' | 'ADD_PRO_MODAL';

    // Expense
    amount?: number;
    description?: string;

    // Actions & Updates
    actionType?:
    | 'CHANGE_RENT'
    | 'ASSIGN_PROFESSIONAL'
    | 'CHANGE_TENANT'
    | 'CREATE_NOTE'
    | 'SET_VALUE' // Generic field update
    | 'FINISH_MAINTENANCE' // Finish maintenance task
    | 'CREATE_NEW'; // For creating new entities

    // Data Payloads
    newRent?: number;
    newTenant?: string;
    professionalName?: string;
    noteContent?: string;
    field?: string; // Field to update
    value?: string | number | boolean; // Value to set

    // Call specific
    phoneNumber?: string;
    contactName?: string;

    // Geocoding support
    coordinates?: [number, number];
    address?: string;
  };
}

// Web Speech API Types
export interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}
