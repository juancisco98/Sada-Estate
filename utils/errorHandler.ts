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
