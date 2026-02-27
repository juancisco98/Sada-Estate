import React from 'react';
import { MaintenanceTask, Property, Professional } from '../types';
import { X, Receipt, Calendar, Hammer, Building2, Home } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface ExpenseBreakdownModalProps {
  month: number; // 0-indexed
  year: number;
  maintenanceTasks: MaintenanceTask[];
  properties: Property[];
  professionals: Professional[];
  onClose: () => void;
}

interface ExpenseItem {
  id: string;
  description: string;
  mainTask: string;
  date: string;
  amount: number;
  professionalName?: string;
  propertyAddress: string;
  propertyId: string;
  tenantName: string;
  isPartial: boolean;
}

const ExpenseBreakdownModal: React.FC<ExpenseBreakdownModalProps> = ({
  month,
  year,
  maintenanceTasks,
  properties,
  professionals,
  onClose
}) => {
  // Collect all expense items that fall in this month
  const expenseItems: ExpenseItem[] = [];

  maintenanceTasks.forEach(task => {
    const property = properties.find(p => p.id === task.propertyId);
    const professional = professionals.find(p => p.id === task.professionalId);
    const hasPartials = task.partialExpenses && task.partialExpenses.length > 0;

    if (hasPartials) {
      // Add partial expenses that fall in this month
      task.partialExpenses!.forEach(pe => {
        const d = new Date(pe.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
          expenseItems.push({
            id: pe.id,
            description: pe.description,
            mainTask: task.description,
            date: pe.date,
            amount: pe.amount,
            professionalName: professional?.name,
            propertyAddress: property?.address || 'Propiedad desconocida',
            propertyId: task.propertyId,
            tenantName: property?.tenantName || '',
            isPartial: true,
          });
        }
      });

      // Add remainder if completed and endDate falls in this month
      if (task.status === 'COMPLETED' && task.endDate) {
        const endD = new Date(task.endDate);
        if (endD.getMonth() === month && endD.getFullYear() === year) {
          const totalPartial = task.partialExpenses!.reduce((s, p) => s + p.amount, 0);
          const remainder = Math.max(0, (task.cost || 0) - totalPartial);
          if (remainder > 0) {
            expenseItems.push({
              id: `${task.id}-remainder`,
              description: 'Cierre / Ajuste Final',
              mainTask: task.description,
              date: task.endDate,
              amount: remainder,
              professionalName: professional?.name,
              propertyAddress: property?.address || 'Propiedad desconocida',
              propertyId: task.propertyId,
              tenantName: property?.tenantName || '',
              isPartial: false,
            });
          }
        }
      }
    } else {
      // No partials: check if the task's reference date falls in this month
      const refDate = new Date(task.endDate || task.startDate);
      if (refDate.getMonth() === month && refDate.getFullYear() === year) {
        expenseItems.push({
          id: task.id,
          description: task.description,
          mainTask: task.description,
          date: task.endDate || task.startDate,
          amount: task.cost || task.estimatedCost || 0,
          professionalName: professional?.name,
          propertyAddress: property?.address || 'Propiedad desconocida',
          propertyId: task.propertyId,
          tenantName: property?.tenantName || '',
          isPartial: false,
        });
      }
    }
  });

  // Group by property
  const groupedByProperty = expenseItems.reduce<Record<string, { address: string; tenantName: string; items: ExpenseItem[]; total: number }>>((acc, item) => {
    if (!acc[item.propertyId]) {
      acc[item.propertyId] = {
        address: item.propertyAddress,
        tenantName: item.tenantName,
        items: [],
        total: 0,
      };
    }
    acc[item.propertyId].items.push(item);
    acc[item.propertyId].total += item.amount;
    return acc;
  }, {});

  const propertyGroups = Object.entries(groupedByProperty).sort((a, b) => b[1].total - a[1].total);
  const monthTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#f8fafc] rounded-[2.5rem] w-full max-w-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden relative flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-8 pb-6 bg-white border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2">Detalle de Gastos</p>
              <h2 className="text-3xl font-black text-slate-900 leading-tight">
                {MONTH_NAMES_FULL[month]} {year}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {expenseItems.length} gasto{expenseItems.length !== 1 ? 's' : ''} en {propertyGroups.length} inmueble{propertyGroups.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-slate-100 hover:shadow-md rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Month Total Card */}
          <div className="mt-6 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-orange-500 rounded-[1.5rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative bg-slate-900 p-5 rounded-[1.3rem] text-white shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                  <Hammer className="w-5 h-5 text-rose-300" />
                </div>
                <span className="text-sm font-bold text-slate-300">Total del Mes</span>
              </div>
              <p className="text-2xl font-black text-rose-400">{formatCurrency(monthTotal, 'ARS')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 flex-1 overflow-y-auto custom-scrollbar">
          {propertyGroups.length > 0 ? (
            <div className="space-y-6">
              {propertyGroups.map(([propertyId, group]) => (
                <div key={propertyId} className="bg-white rounded-[1.8rem] border border-slate-100 shadow-sm overflow-hidden">
                  {/* Property Header */}
                  <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-200 rounded-xl">
                        <Home className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{group.address}</p>
                        {group.tenantName && (
                          <p className="text-xs text-slate-400 mt-0.5">{group.tenantName}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-black text-rose-500">{formatCurrency(group.total, 'ARS')}</span>
                  </div>

                  {/* Expense Items */}
                  <div className="divide-y divide-slate-50">
                    {group.items
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(item => (
                        <div key={item.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex gap-3">
                            <div className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${item.isPartial ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                              {item.isPartial ? <Calendar className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight uppercase tracking-tight">{item.description}</p>
                              {item.isPartial && (
                                <p className="text-xs text-slate-400 mt-0.5 italic">Obra: {item.mainTask}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                {item.professionalName && (
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-widest">
                                    {item.professionalName}
                                  </span>
                                )}
                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-base font-black text-rose-500 shrink-0">
                            - {formatCurrency(item.amount, 'ARS')}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-10">
              <div className="w-24 h-24 bg-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6 text-slate-400">
                <Receipt className="w-10 h-10 opacity-50" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">Sin gastos este mes</h4>
              <p className="text-sm font-semibold text-slate-400 max-w-[240px]">No se encontraron gastos de mantenimiento registrados para este periodo.</p>
            </div>
          )}
        </div>

        {/* Footer Legend */}
        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-amber-500/20"></div>
            GASTO PARCIAL
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-indigo-500/20"></div>
            COSTO FINAL / TOTAL
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseBreakdownModal;
