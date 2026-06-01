import React from 'react';
import { Tenant, TenantPayment, MaintenanceTask } from '../../types';
import { Home, ChevronUp, ChevronDown, Clock, CheckCircle, FileText, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../utils/currency';
import { MONTH_NAMES_SHORT, TenantMetrics } from './shared';

interface TenantCardProps {
    tenant: Tenant;
    metrics: TenantMetrics;
    isExpanded: boolean;
    onToggleExpand: () => void;
    getPropertyAddress: (propertyId: string | null, short?: boolean) => string;
    maintenanceTasks: MaintenanceTask[];
    payments: TenantPayment[];
    paymentByTenantMonth: Map<string, TenantPayment>;
    onOpenPaymentModal: (tenantId: string, paymentToEdit?: TenantPayment, initialData?: { month: number; year: number }) => void;
    onEditTenant: (tenant: Tenant) => void;
    onDeleteTenant: (tenantId: string) => void;
}

const TenantCard: React.FC<TenantCardProps> = ({
    tenant,
    metrics,
    isExpanded,
    onToggleExpand,
    getPropertyAddress,
    maintenanceTasks,
    payments,
    paymentByTenantMonth,
    onOpenPaymentModal,
    onEditTenant,
    onDeleteTenant,
}) => {
    return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.2rem] border border-white dark:border-white/10 shadow-lg dark:shadow-none overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:border-indigo-500/40 hover:scale-[1.01] hover:translate-x-1 group mb-3">
            {/* Main Row */}
            <div
                className="flex items-center p-6 gap-5 cursor-pointer"
                onClick={onToggleExpand}
            >
                {/* Status Indicator Dot */}
                <div className={`w-3 h-3 rounded-full shrink-0 ${metrics.onTimeRate >= 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                    metrics.onTimeRate >= 50 ? 'bg-amber-400' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                    }`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase">
                            {tenant.name}
                        </h3>
                        {metrics.totalPayments > 0 && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${metrics.onTimeRate >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                metrics.onTimeRate >= 50 ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                    'text-rose-600 bg-rose-50 border-rose-100'
                                }`}>
                                {metrics.onTimeRate >= 80 ? 'Ejemplar' : metrics.onTimeRate >= 50 ? 'Regular' : 'Moroso'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                            <Home size={14} className="text-slate-400" />
                        </div>
                        <p className="text-lg font-black uppercase tracking-tight truncate" title={getPropertyAddress(tenant.propertyId, false)}>
                            {getPropertyAddress(tenant.propertyId, true)}
                        </p>
                    </div>
                </div>

                {/* Metrics Summary */}
                <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mb-0.5">Total Pagado</p>
                        <p className="text-base font-black text-slate-700 dark:text-white tabular-nums">
                            {metrics.totalPaid > 0 ? formatCurrency(metrics.totalPaid, metrics.currency).split(',')[0] : '—'}
                        </p>
                    </div>
                    <div className={`p-2 rounded-2xl transition-all ${isExpanded ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-slate-50 dark:bg-white/5 text-slate-300 dark:text-indigo-400/50'}`}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-gray-100 dark:border-white/5 p-5 bg-gray-50/50 dark:bg-slate-800/50 space-y-5 animate-in slide-in-from-top-2 duration-200">

                    {/* Owner View: Financial Summary */}
                    <div className="bg-white dark:bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-xs">
                        <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 sm:mb-3">
                            Balance de la Propiedad
                        </p>
                        {(() => {
                            const propExpenses = maintenanceTasks
                                .filter(t => t.propertyId === tenant.propertyId && t.status === 'COMPLETED')
                                .reduce((acc, t) => acc + (t.cost || 0), 0);
                            const net = metrics.totalPaid + metrics.totalExpenses - propExpenses;
                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">ALQUILER</p>
                                        <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                            {formatCurrency(metrics.totalPaid, metrics.currency)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">EXPENSAS</p>
                                        <p className="text-sm sm:text-lg font-bold text-violet-600 dark:text-violet-400">
                                            {metrics.totalExpenses > 0 ? formatCurrency(metrics.totalExpenses, metrics.currency) : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">GASTOS</p>
                                        <p className="text-sm sm:text-lg font-bold text-red-500 dark:text-rose-400">
                                            {formatCurrency(propExpenses, 'ARS')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">NETO</p>
                                        <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                            {formatCurrency(net, 'ARS')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Monthly Grid — Alquiler */}
                    <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                            Historial Alquiler — {new Date().getFullYear()} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Click para editar)</span>
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                            {metrics.monthlyBreakdown.map((m) => {
                                const paymentForMonth = paymentByTenantMonth.get(`${tenant.id}-${m.month}`);
                                const cellStatus = paymentForMonth?.status;
                                const isRevision = cellStatus === 'REVISION' || cellStatus === 'PENDING';
                                const cellClass = isRevision
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
                                    : m.paid
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/10'
                                        : 'bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-slate-700';
                                return (
                                    <div
                                        key={m.month}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (paymentForMonth) {
                                                onOpenPaymentModal(tenant.id, paymentForMonth);
                                            } else {
                                                onOpenPaymentModal(tenant.id, undefined, { month: m.month, year: new Date().getFullYear() });
                                            }
                                        }}
                                        title={paymentForMonth ? "Click para editar pago" : "Click para registrar pago"}
                                        className={`text-center p-2 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 relative ${cellClass}`}
                                    >
                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">
                                            {MONTH_NAMES_SHORT[m.month - 1]}
                                        </p>
                                        {isRevision ? (
                                            <Clock size={16} className="text-amber-500 dark:text-amber-400 mx-auto" />
                                        ) : m.paid ? (
                                            <CheckCircle size={16} className="text-green-500 mx-auto" />
                                        ) : (
                                            <div className="h-4 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                            </div>
                                        )}
                                        {m.amount > 0 && (
                                            <p className="text-[10px] text-gray-600 dark:text-slate-300 font-bold mt-1 truncate">
                                                {formatCurrency(m.amount, metrics.currency)}
                                            </p>
                                        )}
                                        {m.proofUrl && (
                                            <a
                                                href={m.proofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="block mt-0.5"
                                                title="Ver comprobante alquiler"
                                            >
                                                <FileText size={10} className="text-indigo-400 mx-auto" />
                                            </a>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Monthly Grid — Expensas */}
                    <div className="mt-4">
                        <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                            Historial Expensas — {new Date().getFullYear()} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Click para editar)</span>
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                            {metrics.expenseMonthlyBreakdown.map((m) => {
                                const paymentForMonth = paymentByTenantMonth.get(`${tenant.id}-${m.month}`);
                                const isRevision = m.status === 'REVISION' || m.status === 'PENDING';
                                const cellClass = isRevision
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
                                    : m.paid
                                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-500/10'
                                        : 'bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-slate-700';
                                return (
                                    <div
                                        key={m.month}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (paymentForMonth) {
                                                onOpenPaymentModal(tenant.id, paymentForMonth);
                                            } else {
                                                onOpenPaymentModal(tenant.id, undefined, { month: m.month, year: new Date().getFullYear() });
                                            }
                                        }}
                                        title={m.paid ? "Click para editar — expensas registradas" : "Click para registrar expensas"}
                                        className={`text-center p-2 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 relative ${cellClass}`}
                                    >
                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">
                                            {MONTH_NAMES_SHORT[m.month - 1]}
                                        </p>
                                        {isRevision ? (
                                            <Clock size={16} className="text-amber-500 dark:text-amber-400 mx-auto" />
                                        ) : m.paid ? (
                                            <CheckCircle size={16} className="text-violet-500 mx-auto" />
                                        ) : (
                                            <div className="h-4 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                            </div>
                                        )}
                                        {m.amount > 0 && (
                                            <p className="text-[10px] text-gray-600 dark:text-slate-300 font-bold mt-1 truncate">
                                                {formatCurrency(m.amount, metrics.currency)}
                                            </p>
                                        )}
                                        {m.proofUrl && (
                                            <a
                                                href={m.proofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="block mt-0.5"
                                                title="Ver comprobante expensas"
                                            >
                                                <FileText size={10} className="text-violet-400 mx-auto" />
                                            </a>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Archivo de Comprobantes */}
                    {(() => {
                        const tenantPaymentsWithProofs = payments.filter(
                            p => p.tenantId === tenant.id && (p.proofOfPayment || p.proofOfExpenses)
                        ).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

                        if (tenantPaymentsWithProofs.length === 0) return null;

                        return (
                            <div className="mt-4">
                                <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <FileText size={14} /> Archivo de Comprobantes
                                </p>
                                <div className="space-y-2">
                                    {tenantPaymentsWithProofs.map(p => (
                                        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 w-16">
                                                    {MONTH_NAMES_SHORT[p.month - 1]} {p.year}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    p.status === 'APPROVED' ? 'bg-green-100 dark:bg-emerald-500/20 text-green-700 dark:text-emerald-400' :
                                                    p.status === 'REVISION' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                                                    'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                                }`}>
                                                    {p.status === 'APPROVED' ? 'Aprobado' : p.status === 'REVISION' ? 'Revisión' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {p.proofOfPayment ? (
                                                    <a href={p.proofOfPayment} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                                                        <FileText size={11} /> Alquiler
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-slate-600">Sin alquiler</span>
                                                )}
                                                {p.proofOfExpenses ? (
                                                    <a href={p.proofOfExpenses} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
                                                        <FileText size={11} /> Expensas
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-slate-600">Sin expensas</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenPaymentModal(tenant.id); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold shadow-md active:scale-95 hover:bg-green-600 transition-colors"
                        >
                            <DollarSign size={16} /> Registrar Pago
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditTenant(tenant);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                        >
                            <Edit2 size={16} /> Editar
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`¿Eliminar inquilino "${tenant.name}"?`)) {
                                    onDeleteTenant(tenant.id);
                                    toast.success('Inquilino eliminado');
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-rose-500/10 text-red-500 dark:text-rose-400 border border-red-200 dark:border-rose-500/30 text-sm font-semibold hover:bg-red-100 dark:hover:bg-rose-500/20 transition-colors"
                        >
                            <Trash2 size={16} /> Eliminar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantCard;
