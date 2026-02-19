import { Property, PropertyStatus, Professional, MaintenanceTask, TaskStatus, User } from './types';

// Google Auth Allowlist
// TODO: Replace with the actual Google Emails of your family
export const ALLOWED_EMAILS = [
  'juan.sada98@gmail.com', // Fallback for dev/testing if needed, or remove
  'antovent64@gmail.com', // Replace with your email
  'father@example.com', // Replace with father's email
  'mother@example.com'  // Replace with mother's email
];

// Buenos Aires Center
export const MAP_CENTER: [number, number] = [-34.5997, -58.4000]; // Palermo/Recoleta area center

export const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    address: 'Av. Santa Fe 3200',
    tenantName: 'Roberto Gómez',
    tenantPhone: '11-4567-8901',
    imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop', // Modern apartment
    status: PropertyStatus.CURRENT,
    monthlyRent: 450000,
    coordinates: [-34.5889, -58.4098],
    contractEnd: '2025-12-01',
    lastPaymentDate: '2024-05-05',
    notes: 'El portero se llama José (Turno mañana). Pedir siempre comprobante de transferencia al inquilino.',
    rooms: 3,
    squareMeters: 72,
    country: 'Argentina',
    currency: 'ARS'
  },
  {
    id: '2',
    address: 'Calle Thames 1800',
    tenantName: 'Lucía Mendez',
    tenantPhone: '11-5678-1234',
    imageUrl: 'https://images.unsplash.com/photo-1512918760383-eda2723ad6e1?q=80&w=1000&auto=format&fit=crop', // Classic facade
    status: PropertyStatus.LATE,
    monthlyRent: 380000,
    coordinates: [-34.5873, -58.4287],
    contractEnd: '2024-10-15',
    lastPaymentDate: '2024-03-10',
    notes: 'Ojo con la humedad del baño. Recordar aumentar semestralmente según ICL.',
    assignedProfessionalId: 'p1',
    professionalAssignedDate: '2024-05-10',
    rooms: 2,
    squareMeters: 48,
    country: 'Argentina',
    currency: 'ARS'
  },
  {
    id: '3',
    address: 'Av. Cabildo 2100',
    tenantName: 'Vacante',
    tenantPhone: '-',
    imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=1000&auto=format&fit=crop', // Apartment interior
    status: PropertyStatus.WARNING,
    monthlyRent: 500000,
    coordinates: [-34.5628, -58.4564],
    contractEnd: '2024-06-01',
    lastPaymentDate: '2024-04-01',
    notes: 'Llaves en la inmobiliaria. Mostrar solo lunes y viernes.',
    rooms: 4,
    squareMeters: 95,
    country: 'Argentina',
    currency: 'ARS'
  },
  {
    id: '4',
    address: 'Gorriti 4500',
    tenantName: 'Carlos Tevez',
    tenantPhone: '11-9999-0000',
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-2a4d04774c13?q=80&w=1000&auto=format&fit=crop', // Modern house
    status: PropertyStatus.CURRENT,
    monthlyRent: 600000,
    coordinates: [-34.5936, -58.4239],
    contractEnd: '2026-02-01',
    lastPaymentDate: '2024-05-01',

    rooms: 3,
    squareMeters: 65,
    country: 'Argentina',
    currency: 'ARS'
  },
  {
    id: '5',
    address: '123 Ocean Dr, Miami',
    tenantName: 'John Smith',
    tenantPhone: '+1-305-555-0123',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop', // Miami style
    status: PropertyStatus.CURRENT,
    monthlyRent: 3000000, // Converted from 2500 USD at approx 1200 ARS
    coordinates: [25.7617, -80.1918], // Miami
    contractEnd: '2025-08-01',
    lastPaymentDate: '2024-05-01',
    notes: 'Luxury condo. Handle payments via Zelle.',
    rooms: 2,
    squareMeters: 90,
    country: 'USA',
    currency: 'ARS'
  }
];

export const MOCK_PROFESSIONALS: Professional[] = [
  {
    id: 'p1',
    name: 'Mario',
    profession: 'Gasista',
    rating: 4.8,
    speedRating: 4.2,
    zone: 'Palermo',
    phone: '11-5555-1234'
  },
  {
    id: 'p2',
    name: 'Jorge',
    profession: 'Plomero',
    rating: 3.5,
    speedRating: 4.9,
    zone: 'Belgrano',
    phone: '11-5555-5678'
  },
  {
    id: 'p3',
    name: 'Esteban',
    profession: 'Electricista',
    rating: 4.9,
    speedRating: 3.8,
    zone: 'Recoleta',
    phone: '11-5555-9999'
  }
];

export const MOCK_MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    id: 't1',
    propertyId: '2', // Thames
    professionalId: 'p1', // Mario Gasista
    description: 'Reparación pérdida de gas en cocina',
    status: TaskStatus.IN_PROGRESS,
    startDate: '2024-05-10',
    estimatedCost: 80 // USD ~96000 ARS
  },
  {
    id: 't2',
    propertyId: '3', // Cabildo
    professionalId: 'p3', // Esteban Electricista
    description: 'Cambio de cableado fase 2',
    status: TaskStatus.PENDING,
    startDate: '2024-05-20',
    estimatedCost: 150 // USD ~180000 ARS
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin',
    email: 'admin@sada.com',
    color: '#3b82f6' // Blue
  },
  {
    id: 'u2',
    name: 'Jeshua',
    email: 'jeshua@example.com',
    color: '#10b981' // Emerald
  }
];