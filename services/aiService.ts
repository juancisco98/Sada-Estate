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
        // Extract the actual error from Edge Function response body
        let detailedMessage = error.message || 'Error desconocido';
        try {
            if (error.context && typeof error.context.json === 'function') {
                const body = await error.context.json();
                detailedMessage = body?.error || body?.message || detailedMessage;
            }
        } catch { /* ignore parse errors */ }

        console.error('[AI Service] Error:', { original: error.message, detailed: detailedMessage, error });
        throw new Error(detailedMessage);
    }

    return result?.reminders || [];
}
