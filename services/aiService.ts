import { supabase } from './supabaseClient';

export interface CompactProperty {
    id: string;
    address: string;
    tenantName: string;
    contractEnd?: string;
    contractStart?: string;
    adjustmentMonths?: number;
    monthlyRent: number;
    status: string;
    currency: string;
}

export interface CompactPayment {
    propertyId: string;
    tenantName: string;
    month: number;
    year: number;
    status: string;
    paymentDate: string;
    amount: number;
}

export interface CompactTask {
    id: string;
    propertyId: string;
    address: string;
    professionalName: string;
    description: string;
    startDate: string;
    status: string;
}

export interface CompactProfessional {
    id: string;
    name: string;
    profession: string;
    phone: string;
}

export interface AIReminderRequest {
    properties: CompactProperty[];
    pendingPayments: CompactPayment[];
    activeTasks: CompactTask[];
    professionals: CompactProfessional[];
    currentDate: string;
}

export interface AIReminderResponse {
    title: string;
    description: string;
    urgency: 'overdue' | 'urgent' | 'upcoming';
    entityType?: string;
    entityId?: string;
    suggestedDueDate?: string;
}

export async function generateAIReminders(data: AIReminderRequest): Promise<AIReminderResponse[]> {
    const { data: result, error } = await supabase.functions.invoke('ai-reminders', {
        body: data,
    });

    if (error) {
        // Check if it's a "function not found" error
        if (error.message?.includes('not found') || error.message?.includes('404')) {
            throw new Error('EDGE_FUNCTION_NOT_CONFIGURED');
        }
        throw error;
    }

    return result?.reminders || [];
}
