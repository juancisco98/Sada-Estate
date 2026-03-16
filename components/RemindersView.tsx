import React, { useMemo } from 'react';
import {
    Bell, Sparkles, FileText, TrendingUp, Wrench, Clock, DollarSign,
    ChevronRight, Loader, Bot, AlertTriangle
} from 'lucide-react';
import { SmartReminder, Property, Tenant, Professional, MaintenanceTask } from '../types';

interface RemindersViewProps {
    smartReminders: SmartReminder[];
    onAnalyzeAI: () => Promise<void>;
    isAnalyzing: boolean;
    lastAnalysis: Date | null;
    properties: Property[];
    tenants: Tenant[];
    professionals: Professional[];
    maintenanceTasks: MaintenanceTask[];
    onNavigateToEntity?: (entityType: string, entityId: string) => void;
}

const REMINDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
    CONTRACT_EXPIRY: FileText,
    RENT_ADJUSTMENT_DUE: TrendingUp,
    MAINTENANCE_STALE: Wrench,
    PAYMENT_REVISION_STALE: Clock,
    PAYMENT_OVERDUE: DollarSign,
    AI_GENERATED: Bot,
    MANUAL: Bell,
};

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string; border: string }> = {
    overdue: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Vencido', border: 'border-red-200 dark:border-red-500/20' },
    urgent: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'Urgente', border: 'border-amber-200 dark:border-amber-500/20' },
    upcoming: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-400', label: 'Próximo', border: 'border-indigo-200 dark:border-indigo-500/20' },
    done: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Hecho', border: 'border-emerald-200 dark:border-emerald-500/20' },
};

function formatDueDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < -1) return `Hace ${Math.abs(diffDays)} días`;
    if (diffDays === -1) return 'Ayer';
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 7) return `En ${diffDays} días`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatLastAnalysis(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'Justo ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHrs = Math.floor(diffMin / 60);
    return `Hace ${diffHrs}h`;
}

const RemindersView: React.FC<RemindersViewProps> = ({
    smartReminders, onAnalyzeAI, isAnalyzing, lastAnalysis,
    onNavigateToEntity
}) => {
    // Only show non-completed reminders, sorted by urgency priority
    const urgencyOrder: Record<string, number> = { overdue: 0, urgent: 1, upcoming: 2, done: 3 };
    const activeReminders = useMemo(() =>
        smartReminders
            .filter(r => !r.completed && r.urgency !== 'done')
            .sort((a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9)),
        [smartReminders]
    );

    const handleClick = (reminder: SmartReminder) => {
        if (reminder.entityId && onNavigateToEntity) {
            onNavigateToEntity(reminder.entityType || '', reminder.entityId);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Recordatorios</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        {activeReminders.length > 0
                            ? `${activeReminders.length} pendiente${activeReminders.length > 1 ? 's' : ''} de atención`
                            : 'Todo al día'}
                    </p>
                </div>
                <button
                    onClick={onAnalyzeAI}
                    disabled={isAnalyzing}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 text-sm"
                >
                    {isAnalyzing ? (
                        <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4" />
                    )}
                    {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
            </header>

            {/* Reminder list */}
            <div className="space-y-3">
                {activeReminders.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-100 dark:border-white/5">
                        <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 dark:text-slate-500 font-medium">Sin recordatorios pendientes</p>
                        {smartReminders.length === 0 && (
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                                Presioná "Analizar con IA" para generar recordatorios inteligentes
                            </p>
                        )}
                    </div>
                ) : (
                    activeReminders.map(reminder => {
                        const Icon = REMINDER_ICONS[reminder.type] || Bell;
                        const urgency = URGENCY_STYLES[reminder.urgency] || URGENCY_STYLES.upcoming;
                        const isClickable = !!(reminder.entityId && onNavigateToEntity);

                        return (
                            <div
                                key={reminder.id}
                                onClick={() => handleClick(reminder)}
                                className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border ${urgency.border} p-4 transition-all hover:shadow-md ${
                                    isClickable ? 'cursor-pointer active:scale-[0.99]' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Icon */}
                                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${urgency.bg}`}>
                                        <Icon className={`w-5 h-5 ${urgency.text}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                            {reminder.title}
                                        </h4>
                                        {reminder.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                                {reminder.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right side */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        <div className="text-right">
                                            <span className={`inline-block ${urgency.bg} ${urgency.text} text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5`}>
                                                {urgency.label}
                                            </span>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                {formatDueDate(reminder.dueDate)}
                                            </p>
                                        </div>
                                        {isClickable && (
                                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Last analysis footer */}
            {lastAnalysis && (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
                    Último análisis IA: {formatLastAnalysis(lastAnalysis)}
                </div>
            )}
        </div>
    );
};

export default RemindersView;
