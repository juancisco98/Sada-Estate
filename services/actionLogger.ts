import { supabase } from './supabaseClient';
import { AutomationActionType } from '../types';
import { logger } from '../utils/logger';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

interface LogActionParams {
    actionType: AutomationActionType;
    entityTable: string;
    entityId?: string;
    actionPayload: Record<string, unknown>;
}

/**
 * Registra una acción de admin en admin_action_logs.
 * Fire-and-forget: nunca bloquea la UI ni lanza errores.
 * Obtiene el email del usuario automáticamente desde la sesión de Supabase.
 */
export function logAdminAction(params: LogActionParams): void {
    supabase.auth.getSession().then(({ data }) => {
        const email = data?.session?.user?.email;
        if (!email) return; // No session = no log (tenant or unauthenticated)

        const now = new Date();
        const context = {
            dayOfMonth: now.getDate(),
            dayOfWeek: now.getDay(),
            hourOfDay: now.getHours(),
            timestamp: now.toISOString(),
        };

        supabase
            .from('admin_action_logs')
            .insert({
                id: generateUUID(),
                user_email: email,
                action_type: params.actionType,
                entity_table: params.entityTable,
                entity_id: params.entityId || null,
                action_payload: params.actionPayload,
                context,
            })
            .then(({ error }) => {
                if (error) {
                    logger.warn('[ActionLogger] Failed to log action:', error.message);
                }
            });
    });
}
