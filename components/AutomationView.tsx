import React, { useState, useMemo, useEffect } from 'react';
import {
    Bot, CheckCircle, XCircle, Undo2, Play, Loader, Shield, Zap,
    Clock, TrendingUp, Settings, History, BarChart3, ChevronRight,
    AlertTriangle, Activity
} from 'lucide-react';
import { AutomationRule, AutomationHistoryEntry, Property, Tenant } from '../types';
import { AutomationStats } from '../hooks/useAutomation';

type TabId = 'proposals' | 'history' | 'rules' | 'activity';

interface AutomationViewProps {
    rules: AutomationRule[];
    history: AutomationHistoryEntry[];
    pendingProposals: AutomationHistoryEntry[];
    stats: AutomationStats;
    isAnalyzing: boolean;
    onToggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
    onToggleApprovalRequired: (ruleId: string, requires: boolean) => Promise<void>;
    onUpdateConfidenceThreshold: (ruleId: string, threshold: number) => Promise<void>;
    onApproveProposal: (historyId: string) => Promise<void>;
    onRejectProposal: (historyId: string) => Promise<void>;
    onUndoExecution: (historyId: string) => Promise<void>;
    onTriggerAnalysis: () => Promise<void>;
    onLoadActionLogCount: () => Promise<number>;
    properties: Property[];
    tenants: Tenant[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    PROPOSED: { bg: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-400', label: 'Propuesta' },
    EXECUTED: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Ejecutada' },
    UNDONE: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'Deshecha' },
    REJECTED: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Rechazada' },
    APPROVED: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'Aprobada' },
};

const ACTION_LABELS: Record<string, string> = {
    PAYMENT_APPROVED: 'Aprobar pago',
    PAYMENT_REGISTERED: 'Registrar pago',
    RENT_UPDATED: 'Actualizar alquiler',
    REMINDER_COMPLETED: 'Completar recordatorio',
};

const RULE_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
    AUTO_APPROVE_PAYMENT: CheckCircle,
    AUTO_REGISTER_PAYMENT: Clock,
    AUTO_UPDATE_RENT: TrendingUp,
    AUTO_REMIND: AlertTriangle,
};

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ConfidenceBar({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
        </div>
    );
}

const AutomationView: React.FC<AutomationViewProps> = ({
    rules, history, pendingProposals, stats, isAnalyzing,
    onToggleRule, onToggleApprovalRequired, onUpdateConfidenceThreshold,
    onApproveProposal, onRejectProposal, onUndoExecution,
    onTriggerAnalysis, onLoadActionLogCount,
    properties, tenants
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('proposals');
    const [actionLogCount, setActionLogCount] = useState(0);
    const [historyFilter, setHistoryFilter] = useState<string>('all');

    useEffect(() => {
        onLoadActionLogCount().then(setActionLogCount);
    }, [onLoadActionLogCount]);

    const tabs: { id: TabId; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
        { id: 'proposals', label: 'Propuestas', icon: Zap, badge: pendingProposals.length },
        { id: 'history', label: 'Historial', icon: History },
        { id: 'rules', label: 'Reglas', icon: Settings },
        { id: 'activity', label: 'Actividad', icon: BarChart3 },
    ];

    const filteredHistory = useMemo(() => {
        if (historyFilter === 'all') return history;
        return history.filter(h => h.status === historyFilter);
    }, [history, historyFilter]);

    const executedHistory = useMemo(() => history.filter(h => h.status === 'EXECUTED'), [history]);

    // ── Render ──

    return (
        <div className="pb-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-100 dark:bg-violet-500/20 rounded-2xl">
                        <Bot className="w-7 h-7 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automatizaciones</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            El sistema aprende de tus acciones y propone automatizaciones
                        </p>
                    </div>
                </div>
                <button
                    onClick={onTriggerAnalysis}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-violet-200/50 dark:shadow-none"
                >
                    {isAnalyzing ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {(tab.badge ?? 0) > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'proposals' && (
                <ProposalsTab
                    proposals={pendingProposals}
                    onApprove={onApproveProposal}
                    onReject={onRejectProposal}
                    properties={properties}
                    tenants={tenants}
                />
            )}

            {activeTab === 'history' && (
                <HistoryTab
                    history={filteredHistory}
                    filter={historyFilter}
                    onFilterChange={setHistoryFilter}
                    onUndo={onUndoExecution}
                    properties={properties}
                />
            )}

            {activeTab === 'rules' && (
                <RulesTab
                    rules={rules}
                    onToggleRule={onToggleRule}
                    onToggleApproval={onToggleApprovalRequired}
                    onUpdateThreshold={onUpdateConfidenceThreshold}
                />
            )}

            {activeTab === 'activity' && (
                <ActivityTab
                    stats={stats}
                    actionLogCount={actionLogCount}
                    executedHistory={executedHistory}
                />
            )}
        </div>
    );
};

// ════════════════════════════════════════════
//  Tab: Propuestas
// ════════════════════════════════════════════

const ProposalsTab: React.FC<{
    proposals: AutomationHistoryEntry[];
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string) => Promise<void>;
    properties: Property[];
    tenants: Tenant[];
}> = ({ proposals, onApprove, onReject, properties, tenants }) => {
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setLoading(id);
        try {
            if (action === 'approve') await onApprove(id);
            else await onReject(id);
        } finally {
            setLoading(null);
        }
    };

    if (proposals.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="p-4 bg-gray-100 dark:bg-slate-800 rounded-2xl inline-block mb-4">
                    <Bot className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Sin propuestas pendientes</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Usá el botón "Analizar con IA" para generar nuevas propuestas
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {proposals.map(proposal => {
                const isLoading = loading === proposal.id;
                return (
                    <div key={proposal.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-white/10 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES.PROPOSED.bg} ${STATUS_STYLES.PROPOSED.text}`}>
                                        {ACTION_LABELS[proposal.actionType] || proposal.actionType}
                                    </span>
                                    {proposal.confidence != null && (
                                        <div className="w-24">
                                            <ConfidenceBar value={proposal.confidence} />
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                    {proposal.description || `Acción: ${proposal.actionType}`}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {formatDate(proposal.proposedAt)} — {proposal.entityTable}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => handleAction(proposal.id, 'approve')}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Aprobar
                                </button>
                                <button
                                    onClick={() => handleAction(proposal.id, 'reject')}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Rechazar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ════════════════════════════════════════════
//  Tab: Historial
// ════════════════════════════════════════════

const HistoryTab: React.FC<{
    history: AutomationHistoryEntry[];
    filter: string;
    onFilterChange: (f: string) => void;
    onUndo: (id: string) => Promise<void>;
    properties: Property[];
}> = ({ history, filter, onFilterChange, onUndo, properties }) => {
    const [undoing, setUndoing] = useState<string | null>(null);

    const handleUndo = async (id: string) => {
        setUndoing(id);
        try {
            await onUndo(id);
        } finally {
            setUndoing(null);
        }
    };

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: 'EXECUTED', label: 'Ejecutados' },
        { id: 'UNDONE', label: 'Deshechos' },
        { id: 'REJECTED', label: 'Rechazados' },
    ];

    return (
        <div>
            <div className="flex gap-2 mb-4">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => onFilterChange(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            filter === f.id
                                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {history.length === 0 ? (
                <div className="text-center py-16">
                    <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Sin historial</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {history.map(entry => {
                        const style = STATUS_STYLES[entry.status] || STATUS_STYLES.PROPOSED;
                        return (
                            <div key={entry.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-white/10">
                                <div className={`p-2 rounded-lg ${style.bg}`}>
                                    <Activity className={`w-4 h-4 ${style.text}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                        {entry.description || ACTION_LABELS[entry.actionType] || entry.actionType}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                            {style.label}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {formatDate(entry.executedAt || entry.proposedAt)}
                                        </span>
                                        {entry.executedBy && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                por {entry.executedBy.split('@')[0]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {entry.status === 'EXECUTED' && entry.undoPayload && (
                                    <button
                                        onClick={() => handleUndo(entry.id)}
                                        disabled={undoing === entry.id}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {undoing === entry.id ? <Loader className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                                        Deshacer
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ════════════════════════════════════════════
//  Tab: Reglas
// ════════════════════════════════════════════

const RulesTab: React.FC<{
    rules: AutomationRule[];
    onToggleRule: (id: string, enabled: boolean) => Promise<void>;
    onToggleApproval: (id: string, requires: boolean) => Promise<void>;
    onUpdateThreshold: (id: string, threshold: number) => Promise<void>;
}> = ({ rules, onToggleRule, onToggleApproval, onUpdateThreshold }) => {

    if (rules.length === 0) {
        return (
            <div className="text-center py-16">
                <Settings className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 text-sm">No hay reglas de automatización configuradas</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {rules.map(rule => {
                const Icon = RULE_TYPE_ICONS[rule.ruleType] || Bot;
                return (
                    <div key={rule.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-white/10 shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${rule.enabled ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-gray-100 dark:bg-slate-700'}`}>
                                    <Icon className={`w-5 h-5 ${rule.enabled ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{rule.name}</h3>
                                    {rule.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rule.description}</p>
                                    )}
                                </div>
                            </div>
                            {/* Toggle switch */}
                            <button
                                onClick={() => onToggleRule(rule.id, !rule.enabled)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${
                                    rule.enabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                    rule.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

                        {rule.enabled && (
                            <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/5">
                                {/* Requires approval toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-gray-400" />
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Requiere aprobación manual</span>
                                    </div>
                                    <button
                                        onClick={() => onToggleApproval(rule.id, !rule.requiresApproval)}
                                        className={`relative w-9 h-5 rounded-full transition-colors ${
                                            rule.requiresApproval ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                            rule.requiresApproval ? 'translate-x-[18px]' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>

                                {/* Confidence threshold slider */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Umbral de confianza</span>
                                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{Math.round(rule.confidenceThreshold * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="1"
                                        step="0.05"
                                        value={rule.confidenceThreshold}
                                        onChange={(e) => onUpdateThreshold(rule.id, parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-600"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ════════════════════════════════════════════
//  Tab: Actividad
// ════════════════════════════════════════════

const ActivityTab: React.FC<{
    stats: AutomationStats;
    actionLogCount: number;
    executedHistory: AutomationHistoryEntry[];
}> = ({ stats, actionLogCount, executedHistory }) => {

    const statCards = [
        { label: 'Acciones registradas', value: actionLogCount, icon: Activity, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/20' },
        { label: 'Propuestas generadas', value: stats.totalProposed, icon: Zap, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/20' },
        { label: 'Ejecutadas', value: stats.totalExecuted, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
        { label: 'Deshechas', value: stats.totalUndone, icon: Undo2, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
        { label: 'Rechazadas', value: stats.totalRejected, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' },
        { label: 'Pendientes', value: stats.pendingProposals, icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
    ];

    return (
        <div>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {statCards.map(card => (
                    <div key={card.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-lg ${card.bg}`}>
                                <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Learning progress */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-500" />
                    Progreso de aprendizaje
                </h3>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Acciones registradas</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{actionLogCount} / 50 para primeras sugerencias</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (actionLogCount / 50) * 100)}%` }}
                            />
                        </div>
                    </div>
                    {actionLogCount < 50 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Seguí usando la app normalmente. El sistema necesita al menos 50 acciones para empezar a detectar patrones confiables.
                        </p>
                    )}
                    {actionLogCount >= 50 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            El sistema ya tiene suficientes datos para generar propuestas. Usá "Analizar con IA" para ver sugerencias.
                        </p>
                    )}
                </div>
            </div>

            {/* Recent executions */}
            {executedHistory.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Últimas ejecuciones</h3>
                    <div className="space-y-2">
                        {executedHistory.slice(0, 5).map(entry => (
                            <div key={entry.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-white/10">
                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                <p className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                    {entry.description || entry.actionType}
                                </p>
                                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                                    {formatDate(entry.executedAt || entry.proposedAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutomationView;
