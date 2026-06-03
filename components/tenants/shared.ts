import { TenantPayment } from '../../types';

// Nombres de mes abreviados — fuente única en constants.ts (re-export por conveniencia).
export { MONTH_NAMES_SHORT } from '../../constants';

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
    status: 'PENDING' | 'REVISION' | 'APPROVED' | 'RETURNED';
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
