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
  // Calculate total maintenance by summing up all actual costs
  const totalMaintenance = expenses.reduce((acc, expense) => {
    const hasPartial = expense.partialExpenses && expense.partialExpenses.length > 0;
    const totalPartial = hasPartial ? expense.partialExpenses!.reduce((sum, p) => sum + p.amount, 0) : 0;
    const isCompleted = expense.status === 'COMPLETED';
    const finalCost = expense.cost || 0;
    const remainder = isCompleted ? Math.max(0, finalCost - totalPartial) : 0;

    // If it has partials, sum partials + remainder
    if (hasPartial) {
      return acc + totalPartial + remainder;
    }
    // If no partials, use cost or estimatedCost
    return acc + (expense.cost || expense.estimatedCost || 0);
  }, 0);

  const totalExpenses = totalMaintenance;
  const netResult = property.monthlyRent - totalExpenses;

  const displayCurrency = property.currency || 'ARS';

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-[#f8fafc] rounded-[2.5rem] w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden relative flex flex-col md:flex-row h-auto max-h-[90vh]">

        {/* Left Column: Summary & Main Stats */}
        <div className="w-full md:w-[400px] border-r border-slate-200 bg-white p-8 flex flex-col">
          {/* Header */}
          <div className="relative mb-8">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Resumen Financiero</p>
            <h2 className="text-3xl font-black text-slate-900 leading-tight mb-2">{property.address}</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-sm font-semibold text-slate-500 capitalize">{property.tenantName || 'Sin inquilino asignado'}</p>
            </div>

            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 md:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            {/* Net Result Highlight - Premium Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-slate-900 p-6 rounded-[1.8rem] text-white shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                    <DollarSign className="w-6 h-6 text-indigo-300" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Resultado Neto</span>
                </div>
                <p className={`text-4xl font-black tracking-tighter ${netResult >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatCurrency(netResult, displayCurrency)}
                </p>
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${netResult >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(Math.max((netResult / (property.monthlyRent || 1)) * 100, 0), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Main Numbers: Income vs Expenses */}
            <div className="grid grid-gap-4 space-y-3">
              <div className="bg-emerald-50/50 p-5 rounded-[1.5rem] border border-emerald-100/50 group hover:bg-emerald-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Ingreso Total</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600/50">MENSUAL</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(property.monthlyRent, displayCurrency)}</p>
              </div>

              <div className="bg-rose-50/50 p-5 rounded-[1.5rem] border border-rose-100/50 group hover:bg-rose-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-rose-700">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Gastos Totales</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600/50">MANTENIMIENTO</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(totalExpenses, displayCurrency)}</p>
              </div>
            </div>

            {/* Property Specs */}
            <div className="grid grid-cols-2 gap-3">
              {property.squareMeters && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Superficie</p>
                  <p className="text-lg font-black text-slate-900">{property.squareMeters} m²</p>
                </div>
              )}
              {property.rooms && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ambientes</p>
                  <p className="text-lg font-black text-slate-900">{property.rooms}</p>
                </div>
              )}
              {property.squareMeters && property.monthlyRent > 0 && (
                <div className="col-span-2 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 flex justify-between items-center">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Rentabilidad m²</p>
                  <p className="text-base font-black text-indigo-900">
                    {formatCurrency(Math.round(property.monthlyRent / property.squareMeters), displayCurrency)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          {/* Header for Desktop */}
          <div className="p-8 pb-4 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-slate-200 rounded-xl">
                <Receipt className="w-5 h-5 text-slate-600" />
              </div>
              Desglose Detallado de Gastos
            </h3>
            <button
              onClick={onClose}
              className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 hidden md:flex"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 pt-2 flex-1 overflow-y-auto custom-scrollbar">
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
                      className="bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group flex items-start justify-between gap-4"
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1 h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${item.isPartial ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                          {item.isPartial ? <Calendar className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.description}</p>
                          {item.isPartial && (
                            <p className="text-xs font-semibold text-slate-400 mt-0.5 italic">Obra: {item.mainTask}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full uppercase tracking-widest">
                              {item.proName || 'Mantenimiento General'}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                              <Calendar className="w-3.5 h-3.5" /> {new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-rose-500">
                          - {formatCurrency(item.amount, 'ARS')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center px-10">
                <div className="w-24 h-24 bg-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6 text-slate-400">
                  <Receipt className="w-10 h-10 opacity-50" />
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-2">Sin gastos registrados</h4>
                <p className="text-sm font-semibold text-slate-400 max-w-[240px]">No se encontraron registros de mantenimiento para este inmueble en el periodo seleccionado.</p>
              </div>
            )}
          </div>

          {/* Legend/Footer */}
          <div className="p-8 pt-4 bg-slate-50/80 border-t border-slate-100 flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-amber-500/20"></div>
              PAGO PARCIAL
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-indigo-500/20"></div>
              COSTO FINAL / TOTAL
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinancialDetailsCard;