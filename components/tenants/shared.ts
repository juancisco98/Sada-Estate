import { TenantPayment } from '../../types';

// Nombres de mes abreviados — usados por las grillas mensuales y el modal de pago.
export const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Formulario de alta/edición de inquilino.
export interface NewTenantForm {
    name: string;
    phone: string;
    email: string;
    propertyId: string;
}

// Formulario de registro/edición de pago.
export interface NewPaymentForm {
    amount: string;
    expenseAmount: string;
    month: number;
    year: number;
    paidOnTime: boolean;
    paymentMethod: 'CASH' | 'TRANSFER';
    proofOfPayment: string;
    proofOfExpenses: string;
    status: 'PENDING' | 'REVISION' | 'APPROVED';
    notes: string;
}

// Métricas calculadas por inquilino (forma de retorno de getTenantMetrics).
export interface TenantMetrics {
    totalPaid: number;
    totalExpenses: number;
    totalPayments: number;
    onTimePayments: number;
    onTimeRate: number;
    monthlyBreakdown: { month: number; amount: number; paid: boolean; status?: string; proofUrl?: string }[];
    expenseMonthlyBreakdown: { month: number; amount: number; paid: boolean; status?: string; proofUrl?: string }[];
    currency: string;
}

export type { TenantPayment };
