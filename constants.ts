import { Property, PropertyStatus, Professional, MaintenanceTask, TaskStatus, User } from './types';

// Google Auth Allowlist
export const ALLOWED_EMAILS = import.meta.env.VITE_ALLOWED_EMAILS
  ? import.meta.env.VITE_ALLOWED_EMAILS.split(',')
  : [];

// Buenos Aires Center
export const MAP_CENTER: [number, number] = [-34.5997, -58.4000]; // Palermo/Recoleta area center



export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];