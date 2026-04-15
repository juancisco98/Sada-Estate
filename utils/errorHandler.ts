import { toast } from 'sonner';
import { logger } from './logger';

/**
 * Centralized error handler.
 * Logs the full error in dev and shows a user-friendly toast.
 */
export const handleError = (error: unknown, userMessage?: string) => {
    logger.error('[AppError]', error);

    const message = userMessage || 'Ha ocurrido un error inesperado. Por favor intente nuevamente.';
    toast.error(message);
};

/**
 * Extrae un mensaje legible de un valor desconocido (típico de catch blocks).
 * Reemplaza el patrón anti-pattern `catch (e: any)` + `e?.message`.
 */
export const errorMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e !== null && 'message' in e) {
        const m = (e as { message: unknown }).message;
        return typeof m === 'string' ? m : String(m);
    }
    return String(e ?? '');
};
