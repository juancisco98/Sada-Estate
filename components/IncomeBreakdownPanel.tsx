
import React from 'react';
import { Building, Property, TenantPayment } from '../types';
import { formatCurrency } from '../utils/currency';
import { getPropertyDisplayInfo } from '../utils/property';
import { Building2, ExternalLink, Clock, CheckCircle } from 'lucide-react';

interface IncomeBreakdownPanelProps {
    properties: Property[];
    buildings: Building[];
    currency: 'ARS' | 'USD';
    payments: TenantPayment[];
    selectedMonth: number;
    selectedYear: number;
}

const PaymentBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (status === 'REVISION' || status === 'PENDING') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" /> Revisión
            </span>
        );
    }
    if (status === 'APPROVED') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" /> Aprobado
            </span>
        );
    }
    return null;
};

const ProofLinks: React.FC<{ payment: TenantPayment }> = ({ payment }) => (
    <div className="flex items-center gap-2 mt-1">
        {payment.proofOfPayment && (
            <a
                href={payment.proofOfPayment}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                title="Ver comprobante de alquiler"
            >
                <ExternalLink className="w-2.5 h-2.5" /> Alquiler
            </a>
        )}
        {payment.proofOfExpenses && (
            <a
                href={payment.proofOfExpenses}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                title="Ver comprobante de expensas"
            >
                <ExternalLink className="w-2.5 h-2.5" /> Expensas
            </a>
        )}
    </div>
);

const IncomeBreakdownPanel: React.FC<IncomeBreakdownPanelProps> = ({
    properties, buildings, currency, payments, selectedMonth, selectedYear
}) => {
    const currencyProperties = properties.filter(p => (p.currency || 'ARS') === currency);

    const getPropertyPayment = (propertyId: string) =>
        payments.find(p => p.propertyId === propertyId && p.month === selectedMonth && p.year === selectedYear && p.status === 'APPROVED');

    // Group by building
    const buildingGroups = buildings.map(b => {
        const units = currencyProperties.filter(p => p.buildingId === b.id);
        const total = units.reduce((sum, p) => sum + p.monthlyRent, 0);
        return { building: b, units, total };
    }).filter(g => g.units.length > 0);

    // Properties not in any building
    const individualProperties = currencyProperties.filter(p => !p.buildingId);

    const renderAmountCell = (prop: Property) => {
        const payment = getPropertyPayment(prop.id);
        if (payment) {
            return (
                <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-700 tabular-nums">{formatCurrency(payment.amount, currency)}</p>
                    <PaymentBadge status={payment.status} />
                    <ProofLinks payment={payment} />
                </div>
            );
        }
        return (
            <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-400 tabular-nums">{formatCurrency(prop.monthlyRent, currency)}</p>
                <span className="text-[10px] text-slate-400 font-medium">esperado</span>
            </div>
        );
    };

    return (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Desglose por Propiedad</h4>

            {/* Buildings Breakdown */}
            {buildingGroups.map(group => (
                <div key={group.building.id} className="mb-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="font-bold text-slate-700 dark:text-slate-200" title={group.building.name}>{group.building.name}</span>
                            <span className="text-xs text-slate-400">({group.units.length} un.)</span>
                        </div>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(group.total, currency)}</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {group.units.map(unit => {
                            const display = getPropertyDisplayInfo(unit);
                            return (
                                <div key={unit.id} className="p-4 flex justify-between items-start hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group/unit">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${unit.status === 'CURRENT' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                            unit.status === 'LATE' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                        }`} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover/unit:text-indigo-600 dark:group-hover/unit:text-indigo-400 transition-colors uppercase truncate" title={display.title}>
                                                {display.title}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={display.subtitle}>
                                                {display.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    {renderAmountCell(unit)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Individual Properties */}
            {individualProperties.length > 0 && (
                <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-white/5">
                    {individualProperties.map((prop) => (
                        <div key={prop.id} className="p-4 flex justify-between items-start hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group/prop">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${prop.status === 'CURRENT' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                    prop.status === 'LATE' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                }`} />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white group-hover/prop:text-indigo-600 dark:group-hover/prop:text-indigo-400 transition-colors truncate" title={prop.address}>
                                        {prop.address.split(',')[0]}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={prop.tenantName}>
                                        {prop.tenantName}
                                    </p>
                                </div>
                            </div>
                            {renderAmountCell(prop)}
                        </div>
                    ))}
                </div>
            )}

            {currencyProperties.length === 0 && (
                <p className="text-sm text-center text-slate-400 py-4">No hay propiedades registradas en esta moneda.</p>
            )}
        </div>
    );
};

export default IncomeBreakdownPanel;
