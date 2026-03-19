import React, { useState } from 'react';
import { Zap, CheckCircle, X, Clock, ChevronDown, ChevronUp, History } from 'lucide-react';
import { SmartAction } from '../hooks/useSmartActions';
import { AutomationHistoryEntry } from '../types';
import { MONTH_NAMES } from '../constants';

interface SmartActionsPanelProps {
    actions: SmartAction[];
    executedActions: AutomationHistoryEntry[];
    onExecute: (action: SmartAction) => Promise<void>;
    onDismiss: (actionId: string) => void;
    actionLoading: string | null;
}

const SmartActionsPanel: React.FC<SmartActionsPanelProps> = ({
    actions, executedActions, onExecute, onDismiss, actionLoading,
}) => {
    const [expanded, setExpanded] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    if (actions.length === 0 && executedActions.length === 0) return null;

    return (
        <div className="space-y-3">
            {/* Header */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-2 w-full text-left"
            >
                <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex-1">
                    Acciones Sugeridas
                </h3>
                {actions.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400">
                        {actions.length}
                    </span>
                )}
                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {expanded && (
                <>
                    {/* Actions list */}
                    {actions.length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-6 text-center border border-slate-100 dark:border-white/5">
                            <CheckCircle className="w-8 h-8 text-emerald-300 dark:text-emerald-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">Sin acciones sugeridas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {actions.map(action => {
                                const isLoading = actionLoading === action.id;
                                return (
                                    <div
                                        key={action.id}
                                        className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl border p-4 transition-all ${
                                            action.type === 'AUTO_APPROVE'
                                                ? 'border-violet-200 dark:border-violet-500/20'
                                                : 'border-amber-200 dark:border-amber-500/20'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                                                action.type === 'AUTO_APPROVE'
                                                    ? 'bg-violet-100 dark:bg-violet-500/15'
                                                    : 'bg-amber-100 dark:bg-amber-500/15'
                                            }`}>
                                                {action.type === 'AUTO_APPROVE'
                                                    ? <CheckCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                                    : <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                                    {action.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {action.evidence} · {action.monthLabel}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 ml-12">
                                            <button
                                                onClick={() => onExecute(action)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                                            >
                                                {isLoading ? (
                                                    <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                )}
                                                Aprobar
                                            </button>
                                            <button
                                                onClick={() => onDismiss(action.id)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                            >
                                                <X className="w-3.5 h-3.5" /> Ignorar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* History link */}
                    {executedActions.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowHistory(v => !v)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors px-1"
                            >
                                <History className="w-3.5 h-3.5" />
                                {showHistory ? 'Ocultar historial' : `Ver historial (${executedActions.length})`}
                            </button>

                            {showHistory && (
                                <div className="mt-2 rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                                    {executedActions.map((entry, i) => (
                                        <div
                                            key={entry.id}
                                            className={`px-4 py-2.5 text-xs flex items-center gap-3 ${
                                                i < executedActions.length - 1 ? 'border-b border-slate-50 dark:border-white/5' : ''
                                            }`}
                                        >
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">
                                                {entry.description || entry.actionType}
                                            </span>
                                            <span className="text-slate-400 dark:text-slate-500 shrink-0">
                                                {entry.executedAt ? new Date(entry.executedAt).toLocaleDateString('es-AR') : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SmartActionsPanel;
