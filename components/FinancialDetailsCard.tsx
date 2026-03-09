import React from 'react';
import { Property, MaintenanceTask, Professional } from '../types';
import { X, TrendingUp, TrendingDown, DollarSign, Receipt, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface FinancialDetailsCardProps {
  property: Property;
  maintenanceTasks: MaintenanceTask[];
  professionals: Professional[];
  onClose: () => void;
}

const FinancialDetailsCard: React.FC<FinancialDetailsCardProps> = ({
  property,
  maintenanceTasks,
  professionals,
  onClose
}) => {
  // Filter tasks related to this property
  const expenses = maintenanceTasks.filter(task => task.propertyId === property.id);
  // Calculate total maintenance
  const totalMaintenance = expenses.reduce((acc, expense) => {
    const hasPartial = expense.partialExpenses && expense.partialExpenses.length > 0;
    const totalPartial = hasPartial ? expense.partialExpenses!.reduce((sum, p) => sum + p.amount, 0) : 0;
    const isCompleted = expense.status === 'COMPLETED';
    const finalCost = expense.cost || 0;
    const remainder = isCompleted ? Math.max(0, finalCost - totalPartial) : 0;

    if (hasPartial) return acc + totalPartial + remainder;
    return acc + (expense.cost || expense.estimatedCost || 0);
  }, 0);

  const totalExpenses = totalMaintenance;
  const netResult = property.monthlyRent - totalExpenses;
  const displayCurrency = property.currency || 'ARS';

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white/80 dark:bg-slate-950/95 backdrop-blur-3xl rounded-[3rem] w-full max-w-5xl shadow-2xl dark:shadow-none border border-white/40 dark:border-white/10 overflow-hidden relative flex flex-col md:flex-row h-auto max-h-[90vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Left Column: Summary & Main Stats */}
        <div className="w-full md:w-[400px] border-r border-white/20 bg-white/40 dark:bg-slate-900/40 p-8 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="relative mb-10">
            <div className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full mb-3">
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Resumen Financiero</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2 tracking-tight">{property.address}</h2>
            <div className="flex items-center gap-2 bg-white/50 dark:bg-white/5 w-fit px-3 py-1.5 rounded-full border border-white/50 dark:border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{property.tenantName || 'Sin inquilino'}</p>
            </div>

            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 hover:bg-white/80 rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 md:hidden shadow-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            {/* Net Result Highlight - Premium Card */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[2.2rem] blur-xl opacity-20 group-hover:opacity-40 transition duration-700"></div>
              <div className="relative bg-slate-900 p-7 rounded-[2rem] text-white shadow-2xl overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
                <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl"></div>

                <div className="flex justify-between items-center mb-5 relative">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                    <DollarSign className="w-6 h-6 text-indigo-200" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-300/80 uppercase tracking-[0.2em]">Balance Neto</span>
                </div>
                <div className="relative">
                  <p className={`text-4xl font-black tracking-tighter ${netResult >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {formatCurrency(netResult, displayCurrency)}
                  </p>
                </div>
                <div className="mt-6 space-y-2 relative">
                  <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    <span>Rentabilidad</span>
                    <span>{Math.min(Math.max((netResult / (property.monthlyRent || 1)) * 100, 0), 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${netResult >= 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-rose-400 to-pink-400'}`}
                      style={{ width: `${Math.min(Math.max((netResult / (property.monthlyRent || 1)) * 100, 0), 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Numbers: Income vs Expenses */}
            {/* Ingreso Card */}
            <div className="p-6 bg-white/60 dark:bg-white/5 rounded-[2rem] border border-white/40 dark:border-white/10 group transition-all hover:scale-[1.02]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 transition-transform group-hover:scale-110">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5 leading-none">Ingreso Mensual</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{formatCurrency(property.monthlyRent, displayCurrency)}</p>
                </div>
              </div>
            </div>

            {/* Gastos Card */}
            <div className="p-6 bg-white/60 dark:bg-white/5 rounded-[2rem] border border-white/40 dark:border-white/10 group transition-all hover:scale-[1.02]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl text-rose-500 transition-transform group-hover:scale-110">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1.5 leading-none">Gastos Totales</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{formatCurrency(totalExpenses, displayCurrency)}</p>
                </div>
              </div>
            </div>
            {/* Property Specs */}
            <div className="grid grid-cols-2 gap-3">
              {property.squareMeters && (
                <div className="bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-white/50 dark:border-white/10">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Superficie</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{property.squareMeters} <span className="text-xs font-bold text-slate-400">m²</span></p>
                </div>
              )}
              {property.rooms && (
                <div className="bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-white/50 dark:border-white/10">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Ambientes</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{property.rooms} <span className="text-xs font-bold text-slate-400">Hab.</span></p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/10 backdrop-blur-md">
          {/* Right Column: Detailed Breakdown */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/10 dark:bg-slate-950/50">
            <div className="p-8 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-white dark:text-indigo-400 shadow-lg shadow-indigo-600/20">
                  <Receipt className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Detalle de Mantenimiento</h2>
              </div>
              <button
                onClick={onClose}
                className="p-3 bg-slate-900/5 dark:bg-white/5 hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-2xl transition-all active:scale-95 group border border-transparent hover:border-slate-200 dark:hover:border-white/10 hidden md:block"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            <div className="p-8 pt-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/10 dark:bg-slate-900">
              {expenses.length > 0 ? (
                <div className="space-y-4">
                  {expenses.flatMap(expense => {
                    const professional = professionals.find(p => p.id === expense.professionalId);
                    const hasPartial = expense.partialExpenses && expense.partialExpenses.length > 0;

                    const partials = hasPartial ? expense.partialExpenses!.map(pe => ({
                      id: pe.id,
                      description: pe.description,
                      mainTask: expense.description,
                      date: pe.date,
                      amount: pe.amount,
                      proName: professional?.name,
                      isPartial: true
                    })) : [];

                    const totalPartial = partials.reduce((sum, p) => sum + p.amount, 0);
                    const finalCost = expense.cost || 0;
                    const isCompleted = expense.status === 'COMPLETED';
                    const remainder = isCompleted ? Math.max(0, finalCost - totalPartial) : 0;

                    const items = [...partials];

                    if (!hasPartial || (isCompleted && remainder > 0)) {
                      items.push({
                        id: expense.id,
                        description: hasPartial ? 'Cierre / Ajuste Final' : expense.description,
                        mainTask: expense.description,
                        date: expense.endDate || expense.startDate,
                        amount: hasPartial ? remainder : (expense.cost || expense.estimatedCost || 0),
                        proName: professional?.name,
                        isPartial: false
                      });
                    }

                    return items;
                  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-6 rounded-[2.2rem] border border-white dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all group flex items-start justify-between gap-6"
                      >
                        <div className="flex gap-4 items-center">
                          {/* Status dot indicator */}
                          <div className={`w-3 h-3 rounded-full shrink-0 ${item.isPartial ? 'bg-amber-400' : 'bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.3)]'}`} />

                          <div>
                            <p className="text-base font-black text-slate-800 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  {new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 bg-slate-100 rounded-full flex items-center justify-center">
                                  <span className="text-[8px] font-black text-slate-400">{item.proName?.charAt(0) || 'M'}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {item.proName || 'Mantenimiento SV'}
                                </span>
                              </div>
                              {item.isPartial && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                  Pago Parcial
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-rose-500 tabular-nums">
                            {formatCurrency(item.amount, 'ARS').split(',')[0]}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center px-10">
                  <div className="w-24 h-24 bg-white rounded-[2.8rem] flex items-center justify-center mb-6 text-slate-200 shadow-inner border border-white">
                    <Receipt className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">Sin gastos registrados</h4>
                  <p className="text-sm font-semibold text-slate-400 max-w-[240px]">Todavía no hay cargos por reparaciones en este inmueble.</p>
                </div>
              )}
            </div>

            {/* Legend/Footer */}
            <div className="p-8 py-5 bg-white/40 dark:bg-slate-950/80 border-t border-white/40 dark:border-white/10 flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pago Parcial</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cierre / Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDetailsCard;