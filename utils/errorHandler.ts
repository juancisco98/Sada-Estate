import { toast } from 'sonner';

/**
 * Centralized error handler.
 * Logs the full error to console for debugging and shows a user-friendly toast.
 * 
 * @param error The error object or unknown value caught in try-catch.
 * @param userMessage Optional custom message to show to the user. If not provided, a default generic message is used.
 */
export const handleError = (error: unknown, userMessage?: string) => {
    console.error('[AppError]', error);

    const message = userMessage || 'Ha ocurrido un error inesperado. Por favor intente nuevamente.';
    toast.error(message);
};
