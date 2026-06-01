import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Etiqueta para el log (ej. nombre de la vista). */
    label?: string;
    /** Cambiar este valor resetea el boundary (ej. la vista actual). */
    resetKey?: string | number;
    /** Callback opcional al reintentar. */
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Atrapa errores de render de su subárbol y muestra un fallback amigable
 * en vez de dejar la pantalla en blanco.
 *
 * Lección 11: en flujos críticos se loguea con `console.*` directo, nunca
 * `logger`, porque `logger` queda silenciado en producción (Vercel).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        // Si cambia la vista (resetKey), limpiar el error para reintentar el render.
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] w-full gap-4 p-8 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Algo salió mal</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md">
                        Ocurrió un error al mostrar esta sección. Podés reintentar o recargar la app.
                    </p>
                    {this.state.error?.message && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 font-mono break-words max-w-md mt-2">
                            {this.state.error.message}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <button
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reintentar
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recargar
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
