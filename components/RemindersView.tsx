import React, { useState, useMemo } from 'react';
import {
    Bell, Plus, Sparkles, FileText, TrendingUp, Wrench, Clock, DollarSign,
    CheckCircle, Trash2, ExternalLink, AlertTriangle, Loader, Bot
} from 'lucide-react';
import { SmartReminder, Property, Tenant, Professional, MaintenanceTask, ReminderEntityType } from '../types';
import AddReminderModal from './AddReminderModal';

type FilterTab = 'all' | 'overdue' | 'urgent' | 'upcoming' | 'done';

interface RemindersViewProps {
    smartReminders: SmartReminder[];
    onCreateReminder: (data: { title: string; description?: string; dueDate: string; entityType?: ReminderEntityType; entityId?: string }) => Promise<void>;
    onToggleComplete: (id: string) => Promise<void>;
    onDeleteReminder: (id: string) => Promise<void>;
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

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    overdue: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Vencido' },
    urgent: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'Urgente' },
    upcoming: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-400', label: 'Próximo' },
    done: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Hecho' },
};

const SOURCE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
    ai: { bg: 'bg-gradient-to-r from-violet-500 to-purple-600', text: 'text-white', label: 'IA' },
    auto: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: 'Auto' },
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
    smartReminders, onCreateReminder, onToggleComplete, onDeleteReminder,
    onAnalyzeAI, isAnalyzing, lastAnalysis,
    properties, tenants, professionals, maintenanceTasks,
    onNavigateToEntity
}) => {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [showModal, setShowModal] = useState(false);

    // Stats
    const stats = useMemo(() => ({
        overdue: smartReminders.filter(r => r.urgency === 'overdue').length,
        urgent: smartReminders.filter(r => r.urgency === 'urgent').length,
        upcoming: smartReminders.filter(r => r.urgency === 'upcoming').length,
        done: smartReminders.filter(r => r.urgency === 'done').length,
    }), [smartReminders]);

    // Filter
    const filtered = useMemo(() => {
        if (activeTab === 'all') return smartReminders.filter(r => r.urgency !== 'done');
        return smartReminders.filter(r => r.urgency === activeTab);
    }, [smartReminders, activeTab]);

    const tabs: { id: FilterTab; label: string; count: number }[] = [
        { id: 'all', label: 'Activos', count: stats.overdue + stats.urgent + stats.upcoming },
        { id: 'overdue', label: 'Vencidos', count: stats.overdue },
        { id: 'urgent', label: 'Urgentes', count: stats.urgent },
        { id: 'upcoming', label: 'Próximos', count: stats.upcoming },
        { id: 'done', label: 'Hechos', count: stats.done },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Recordatorios</h2>
                    <p className="text-slate-500 dark:text-slate-400">Tu asistente de gestión diaria</p>
                </div>
                <div className="flex gap-2">
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
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all text-sm"
                    >
                        <Plus className="w-4 h-4" /> Nuevo
                    </button>
                </div>
            </header>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Vencidos', count: stats.overdue, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
                    { label: 'Urgentes', count: stats.urgent, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
                    { label: 'Próximos', count: stats.upcoming, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20' },
                    { label: 'Hechos', count: stats.done, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                activeTab === tab.id ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Reminder cards */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-100 dark:border-white/5">
                        <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 dark:text-slate-500 font-medium">
                            {activeTab === 'done' ? 'No hay recordatorios completados' : 'Sin recordatorios pendientes'}
                        </p>
                        {activeTab !== 'done' && smartReminders.length === 0 && (
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                                Presioná "Analizar con IA" para generar recordatorios inteligentes
                            </p>
                        )}
                    </div>
                ) : (
                    filtered.map(reminder => {
                        const Icon = REMINDER_ICONS[reminder.type] || Bell;
                        const urgency = URGENCY_STYLES[reminder.urgency];
                        const sourceBadge = reminder.source !== 'manual' ? SOURCE_BADGES[reminder.source] : null;

                        return (
                            <div
                                key={reminder.id}
                                className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border p-4 transition-all ${
                                    reminder.completed
                                        ? 'border-slate-100 dark:border-white/5 opacity-60'
                                        : 'border-slate-200/50 dark:border-white/10 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${urgency.bg}`}>
                                        <Icon className={`w-4 h-4 ${urgency.text}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {sourceBadge && (
                                                <span className={`${sourceBadge.bg} ${sourceBadge.text} text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
                                                    {sourceBadge.label}
                                                </span>
                                            )}
                                            <h4 className={`font-bold text-sm ${reminder.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                {reminder.title}
                                            </h4>
                                        </div>
                                        {reminder.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                {reminder.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right side: urgency badge + date */}
                                    <div className="shrink-0 text-right">
                                        <span className={`inline-block ${urgency.bg} ${urgency.text} text-[10px] font-bold px-2 py-0.5 rounded-full mb-1`}>
                                            {urgency.label}
                                        </span>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                            {formatDueDate(reminder.dueDate)}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                                    {reminder.source === 'manual' && (
                                        <>
                                            <button
                                                onClick={() => onToggleComplete(reminder.id)}
                                                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                                                    reminder.completed
                                                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                                                }`}
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                {reminder.completed ? 'Completado' : 'Completar'}
                                            </button>
                                            <button
                                                onClick={() => onDeleteReminder(reminder.id)}
                                                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                    {reminder.entityId && onNavigateToEntity && (
                                        <button
                                            onClick={() => onNavigateToEntity(reminder.entityType || '', reminder.entityId || '')}
                                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors ml-auto"
                                        >
                                            <ExternalLink className="w-3 h-3" /> Ver
                                        </button>
                                    )}
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

            {/* Modal */}
            {showModal && (
                <AddReminderModal
                    onClose={() => setShowModal(false)}
                    onSave={onCreateReminder}
                    properties={properties}
                    tenants={tenants}
                    professionals={professionals}
                    maintenanceTasks={maintenanceTasks}
                />
            )}
        </div>
    );
};

export default RemindersView;
